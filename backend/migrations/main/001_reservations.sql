-- Apply once, after SDK-generated schema migrations, in each tenant schema.
-- Run this migration in one transaction; failures leave the original schema intact.
ALTER TABLE products ADD COLUMN reserved_stock bigint NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0);
ALTER TABLE product_variants ADD COLUMN reserved_stock bigint NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0);
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1;
ALTER TABLE orders ADD COLUMN reservation_expires_at timestamptz;
ALTER TABLE orders ADD COLUMN reservation_active boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN cancellation_reason varchar(200);

-- Old pending orders already reduced available stock. Convert that deduction to a hold.
UPDATE orders SET reservation_active = true, reservation_expires_at = created_at + interval '30 minutes'
WHERE status = 'pending';
UPDATE products p SET reserved_stock = held.quantity
FROM (
  SELECT i.product_id, SUM(i.quantity) AS quantity FROM order_items i
  JOIN orders o ON o.id = i.order_id WHERE o.reservation_active AND i.sku_id IS NULL
  GROUP BY i.product_id
) held WHERE p.id = held.product_id;
UPDATE product_variants v SET reserved_stock = held.quantity
FROM (
  SELECT i.sku_id, SUM(i.quantity) AS quantity FROM order_items i
  JOIN orders o ON o.id = i.order_id WHERE o.reservation_active AND i.sku_id IS NOT NULL
  GROUP BY i.sku_id
) held WHERE v.id = held.sku_id;

-- Existing duplicates must be reconciled before migration; do not silently discard orders.
CREATE UNIQUE INDEX orders_user_idempotency ON orders(user_id, idempotency_key);
CREATE UNIQUE INDEX addresses_one_default ON addresses(user_id) WHERE deleted_at IS NULL AND is_default;
CREATE UNIQUE INDEX variants_product_options ON product_variants(product_id, (options::jsonb));
CREATE INDEX orders_expiry_queue ON orders(reservation_expires_at, id)
WHERE status = 'pending' AND reservation_active;
