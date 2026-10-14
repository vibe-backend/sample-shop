-- SECURITY INVOKER: caller must set the tenant schema and the appropriate RLS context.
-- The worker owns the transaction; this function never commits or rolls back it.
CREATE OR REPLACE FUNCTION shop_expire_pending_orders(batch_size integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  expired_order record;
  product_line record;
  inventory_line record;
  affected integer;
  expired_count integer := 0;
  stamp timestamptz := now();
BEGIN
  IF batch_size < 1 OR batch_size > 1000 THEN
    RAISE EXCEPTION 'batch_size must be between 1 and 1000';
  END IF;
  FOR expired_order IN
    SELECT id, user_id FROM orders
    WHERE status = 'pending' AND reservation_active AND reservation_expires_at <= stamp
    ORDER BY reservation_expires_at, id LIMIT batch_size FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE orders SET status = 'cancelled', reservation_active = false, cancellation_reason = '付款逾時'
    WHERE id = expired_order.id AND status = 'pending' AND reservation_active AND reservation_expires_at <= stamp;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected = 0 THEN CONTINUE; END IF;

    -- Match checkout, payment, cancellation and SKU edits: product first, then its SKUs.
    FOR product_line IN
      SELECT product_id, SUM(quantity) AS quantity FROM order_items
      WHERE order_id = expired_order.id GROUP BY product_id ORDER BY product_id
    LOOP
      PERFORM id FROM products WHERE id = product_line.product_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'missing product for order %', expired_order.id; END IF;
      FOR inventory_line IN
        SELECT sku_id, SUM(quantity) AS quantity FROM order_items
        WHERE order_id = expired_order.id AND product_id = product_line.product_id
        GROUP BY sku_id ORDER BY sku_id NULLS FIRST
      LOOP
        IF inventory_line.sku_id IS NULL THEN
          UPDATE products SET stock = stock + inventory_line.quantity, reserved_stock = reserved_stock - inventory_line.quantity
          WHERE id = product_line.product_id AND reserved_stock >= inventory_line.quantity;
        ELSE
          UPDATE product_variants SET stock = stock + inventory_line.quantity,
            reserved_stock = reserved_stock - inventory_line.quantity, version = version + 1
          WHERE id = inventory_line.sku_id AND product_id = product_line.product_id
            AND reserved_stock >= inventory_line.quantity;
        END IF;
        GET DIAGNOSTICS affected = ROW_COUNT;
        IF affected <> 1 THEN RAISE EXCEPTION 'missing reservation for order %', expired_order.id; END IF;
      END LOOP;
      UPDATE products SET sold_count = greatest(0, sold_count - product_line.quantity) WHERE id = product_line.product_id;
    END LOOP;
    INSERT INTO order_status_events (order_id, user_id, status, at, actor)
    VALUES (expired_order.id, expired_order.user_id, 'cancelled', stamp, 'system');
    expired_count := expired_count + 1;
  END LOOP;
  RETURN expired_count;
END;
$$;
