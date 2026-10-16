import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import pg from 'pg';
import { base, migrate } from './setup.mjs';
const url = process.env.TEST_POSTGRES_URL;

test(
  'two PostgreSQL connections: worker skips a payment lock and late payment cannot beat expiry',
  { skip: !url },
  async () => {
    const schema = 'shop_test_' + randomUUID().replaceAll('-', '');
    const clients = [new pg.Client({ connectionString: url }), new pg.Client({ connectionString: url })];
    await Promise.all(clients.map((c) => c.connect()));
    const [buyer, worker] = clients;
    try {
      await buyer.query(`CREATE SCHEMA ${schema}`);
      await Promise.all(clients.map((c) => c.query(`SET search_path TO ${schema},public`)));
      const db = { exec: (s) => buyer.query(s) };
      await base(db);
      await migrate(db);
      // An expired row locked by another request is skipped, then retried after that lock ends.
      await buyer.query('BEGIN');
      await buyer.query("SELECT id FROM orders WHERE id='00000000-0000-0000-0000-000000000030' FOR UPDATE");
      assert.equal((await worker.query('SELECT shop_expire_pending_orders() n')).rows[0].n, 1);
      await buyer.query('COMMIT');
      assert.equal((await worker.query('SELECT shop_expire_pending_orders() n')).rows[0].n, 1);
      // A live payment consumes its hold, so the worker cannot cancel it later.
      await buyer.query('BEGIN');
      await buyer.query("SELECT id FROM orders WHERE id='00000000-0000-0000-0000-000000000033' FOR UPDATE");
      assert.equal(
        (
          await buyer.query(
            "UPDATE orders SET status='paid',reservation_active=false WHERE id='00000000-0000-0000-0000-000000000033' AND status='pending' AND reservation_active AND reservation_expires_at > clock_timestamp()",
          )
        ).rowCount,
        1,
      );
      await buyer.query(
        "UPDATE products SET reserved_stock=reserved_stock-1 WHERE id='00000000-0000-0000-0000-000000000010' AND reserved_stock>=1",
      );
      await buyer.query('COMMIT');
      assert.equal((await worker.query('SELECT shop_expire_pending_orders() n')).rows[0].n, 0);
      // The scheduler holds an expired order while a payment request waits behind it.
      await worker.query(
        "INSERT INTO orders(id,user_id,status,idempotency_key,request_hash,reservation_active,reservation_expires_at) VALUES ('00000000-0000-0000-0000-000000000034','00000000-0000-0000-0000-000000000001','pending','race','hash',true,clock_timestamp()-interval '1 second')",
      );
      await worker.query(
        "INSERT INTO order_items VALUES ('00000000-0000-0000-0000-000000000034','00000000-0000-0000-0000-000000000010',null,1)",
      );
      await worker.query(
        "UPDATE products SET stock=stock-1,reserved_stock=reserved_stock+1,sold_count=sold_count+1 WHERE id='00000000-0000-0000-0000-000000000010'",
      );
      await worker.query('BEGIN');
      assert.equal((await worker.query('SELECT shop_expire_pending_orders() n')).rows[0].n, 1);
      const latePayment = buyer.query(
        "UPDATE orders SET status='paid',reservation_active=false WHERE id='00000000-0000-0000-0000-000000000034' AND status='pending' AND reservation_active AND reservation_expires_at > clock_timestamp()",
      );
      await worker.query('COMMIT');
      assert.equal((await latePayment).rowCount, 0);
      assert.equal(
        (
          await buyer.query(
            "SELECT count(*)::integer n FROM order_status_events WHERE order_id='00000000-0000-0000-0000-000000000034' AND status='cancelled'",
          )
        ).rows[0].n,
        1,
      );
      // The address trigger serializes concurrent creates even outside the API method.
      await buyer.query(
        "INSERT INTO addresses SELECT gen_random_uuid(),'00000000-0000-0000-0000-000000000001',false,null FROM generate_series(1,19)",
      );
      await buyer.query('BEGIN');
      await buyer.query(
        "INSERT INTO addresses VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000001',false,null)",
      );
      const concurrentAddress = assert.rejects(
        worker.query(
          "INSERT INTO addresses VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000001',false,null)",
        ),
        /ADDRESS_LIMIT/,
      );
      await buyer.query('COMMIT');
      await concurrentAddress;
      assert.equal(
        (await buyer.query('SELECT count(*)::integer n FROM addresses WHERE deleted_at IS NULL')).rows[0].n,
        20,
      );
    } finally {
      await Promise.all(clients.map((c) => c.query('ROLLBACK')));
      await buyer.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await Promise.all(clients.map((c) => c.end()));
    }
  },
);
