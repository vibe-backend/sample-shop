import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { base, migrate } from './setup.mjs';
let db;
beforeEach(async () => {
  db = new PGlite();
  await base(db);
  await migrate(db);
});
afterEach(async () => {
  await db.close();
});
const one = async (query) => (await db.query(query)).rows[0];

test('migrates old pending stock deductions into holds without deducting again', async () => {
  assert.deepEqual(await one('SELECT stock, reserved_stock FROM products ORDER BY id LIMIT 1'), {
    stock: 7,
    reserved_stock: 3,
  });
  assert.equal((await one('SELECT count(*)::integer n FROM orders WHERE reservation_active')).n, 3);
});
test('expires product and inactive SKU holds, appends audit events and restores availability once', async () => {
  assert.equal((await one('SELECT shop_expire_pending_orders() n')).n, 2);
  assert.deepEqual(await one('SELECT stock,reserved_stock,sold_count FROM products ORDER BY id LIMIT 1'), {
    stock: 9,
    reserved_stock: 1,
    sold_count: 1,
  });
  assert.deepEqual(await one('SELECT stock,reserved_stock,version FROM product_variants'), {
    stock: 10,
    reserved_stock: 0,
    version: 2,
  });
  assert.equal(
    (await one("SELECT count(*)::integer n FROM order_status_events WHERE actor='system' AND status='cancelled'")).n,
    2,
  );
  assert.equal((await one('SELECT shop_expire_pending_orders() n')).n, 0);
  assert.equal((await one('SELECT stock FROM product_variants')).stock, 10);
});
test('leaves paid and not-yet-expired orders untouched', async () => {
  await db.query('SELECT shop_expire_pending_orders()');
  assert.deepEqual(
    (
      await db.query(
        "SELECT status,reservation_active FROM orders WHERE id IN ('00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000033') ORDER BY id",
      )
    ).rows,
    [
      { status: 'paid', reservation_active: false },
      { status: 'pending', reservation_active: true },
    ],
  );
});
test('respects bounded batches and rejects invalid batch sizes', async () => {
  assert.equal((await one('SELECT shop_expire_pending_orders(1) n')).n, 1);
  assert.equal((await one('SELECT shop_expire_pending_orders(1) n')).n, 1);
  await assert.rejects(db.query('SELECT shop_expire_pending_orders(0)'), /batch_size/);
});
test('rolls back the entire expiry batch when a reservation is inconsistent', async () => {
  await db.query('UPDATE product_variants SET reserved_stock=0');
  await assert.rejects(db.query('SELECT shop_expire_pending_orders()'), /missing reservation/);
  assert.equal((await one("SELECT count(*)::integer n FROM orders WHERE status='cancelled'")).n, 0);
  assert.equal((await one('SELECT stock FROM products ORDER BY id LIMIT 1')).stock, 7);
  assert.equal((await one('SELECT count(*)::integer n FROM order_status_events')).n, 0);
});
test('enforces order idempotency, unique defaults and canonical SKU option combinations in SQL', async () => {
  await assert.rejects(
    db.query(
      "INSERT INTO orders(id,user_id,status,idempotency_key,request_hash) VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','pending','paid','other')",
    ),
    /orders_user_idempotency/,
  );
  await db.query("INSERT INTO addresses VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000001',true,null)");
  await assert.rejects(
    db.query("INSERT INTO addresses VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000001',true,null)"),
    /addresses_one_default/,
  );
  await assert.rejects(
    db.query(
      'INSERT INTO product_variants(id,product_id,options,stock) VALUES (gen_random_uuid(),\'00000000-0000-0000-0000-000000000011\',\'{"顏色":"黑"}\',10)',
    ),
    /variants_product_options/,
  );
});

test('enforces 20 active addresses while allowing soft deletion and replacement', async () => {
  for (let i = 0; i < 20; i++)
    await db.query(
      "INSERT INTO addresses VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000001',false,null)",
    );
  await assert.rejects(
    db.query("INSERT INTO addresses VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000001',false,null)"),
    /ADDRESS_LIMIT/,
  );
  await db.query('UPDATE addresses SET deleted_at=now() WHERE id=(SELECT id FROM addresses LIMIT 1)');
  await db.query("INSERT INTO addresses VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000001',false,null)");
  assert.equal((await one('SELECT count(*)::integer n FROM addresses WHERE deleted_at IS NULL')).n, 20);
  await assert.rejects(db.query('UPDATE addresses SET deleted_at=null WHERE deleted_at IS NOT NULL'), /ADDRESS_LIMIT/);
});
