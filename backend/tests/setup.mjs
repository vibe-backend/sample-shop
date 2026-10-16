import { readFile } from 'node:fs/promises';
export const sql = async (file) => readFile(new URL(file, import.meta.url), 'utf8');
export async function base(db) {
  await db.exec(await sql('fixtures.sql'));
  await db.exec(`INSERT INTO users VALUES ('00000000-0000-0000-0000-000000000001');
    INSERT INTO products(id, stock, sold_count) VALUES
      ('00000000-0000-0000-0000-000000000010', 7, 3),
      ('00000000-0000-0000-0000-000000000011', 0, 3);
    INSERT INTO product_variants(id,product_id,options,stock,active) VALUES
      ('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000011','{"顏色":"黑"}',7,false);
    INSERT INTO orders(id,user_id,status,created_at,idempotency_key,request_hash) VALUES
      ('00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000001','pending', now()-interval '31 minutes','expired-product','hash'),
      ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000001','pending', now()-interval '31 minutes','expired-sku','hash'),
      ('00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000001','paid', now()-interval '31 minutes','paid','hash'),
      ('00000000-0000-0000-0000-000000000033','00000000-0000-0000-0000-000000000001','pending', now(),'future','hash');
    INSERT INTO order_items VALUES
      ('00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000010',null,2),
      ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000020',3),
      ('00000000-0000-0000-0000-000000000033','00000000-0000-0000-0000-000000000010',null,1);
  `);
}
export async function migrate(db) {
  await db.exec(await sql('../migrations/main/001_reservations.sql'));
  await db.exec(await sql('../migrations/main/002_expiry_function.sql'));
  await db.exec(await sql('../migrations/main/003_address_limit.sql'));
}
