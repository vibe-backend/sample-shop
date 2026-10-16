-- Minimal pre-migration schema fixture, not a generated SDK schema.
CREATE TABLE users (id uuid PRIMARY KEY);
CREATE TABLE products (
  id uuid PRIMARY KEY, stock bigint NOT NULL CHECK (stock >= 0), sold_count bigint NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true, deleted_at timestamptz
);
CREATE TABLE product_variants (
  id uuid PRIMARY KEY, product_id uuid NOT NULL REFERENCES products(id), options jsonb NOT NULL,
  stock bigint NOT NULL CHECK (stock >= 0), active boolean NOT NULL DEFAULT true, deleted_at timestamptz
);
CREATE TABLE orders (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), idempotency_key text NOT NULL, request_hash text NOT NULL
);
CREATE TABLE order_items (
  order_id uuid NOT NULL REFERENCES orders(id), product_id uuid NOT NULL REFERENCES products(id),
  sku_id uuid REFERENCES product_variants(id), quantity bigint NOT NULL CHECK (quantity > 0)
);
CREATE TABLE order_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id),
  user_id uuid NOT NULL REFERENCES users(id), status text NOT NULL, at timestamptz NOT NULL, actor text NOT NULL
);
CREATE TABLE addresses (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), is_default boolean NOT NULL DEFAULT false, deleted_at timestamptz);
