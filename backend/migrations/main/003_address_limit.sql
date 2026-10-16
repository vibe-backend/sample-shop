-- Defense in depth: direct SQL writes also serialize against the same user's address book.
CREATE OR REPLACE FUNCTION shop_check_address_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'address owner is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.deleted_at IS NULL AND (TG_OP = 'INSERT' OR OLD.deleted_at IS NOT NULL) THEN
    PERFORM id FROM users WHERE id = NEW.user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'address owner is not accessible' USING ERRCODE = '23503'; END IF;
    IF (SELECT count(*) FROM addresses WHERE user_id = NEW.user_id AND deleted_at IS NULL) >= 20 THEN
      RAISE EXCEPTION 'ADDRESS_LIMIT' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER addresses_limit BEFORE INSERT OR UPDATE ON addresses
FOR EACH ROW EXECUTE FUNCTION shop_check_address_limit();
