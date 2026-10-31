// Idempotent schema upgrades. Safe to run on every start: everything is IF NOT EXISTS / CREATE OR REPLACE.
// The same SQL is in db/migrations.sql for running by hand.
export const MIGRATION_SQL = String.raw`
-- 1. Store settings (single row, id = 1)
CREATE TABLE IF NOT EXISTS public.store_settings (
  id                            integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_name                    text NOT NULL DEFAULT 'My Clothing Store',
  tagline                       text,
  description                   text,
  logo_url                      text,
  phone                         text,
  whatsapp                      text,
  email                         text,
  website                       text,
  address                       text,
  city                          text,
  district                      text,
  opening_hours                 text,
  facebook_url                  text,
  instagram_url                 text,
  tiktok_url                    text,
  delivery_fee_cents            integer NOT NULL DEFAULT 35000 CHECK (delivery_fee_cents >= 0),
  free_delivery_threshold_cents integer NOT NULL DEFAULT 1000000 CHECK (free_delivery_threshold_cents >= 0),
  delivery_info                 text,
  return_policy                 text,
  bank_name                     text,
  bank_branch                   text,
  bank_account_name             text,
  bank_account_number           text,
  payment_instructions          text,
  updated_at                    timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.store_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 2. Categories (exists on Railway; created here for fresh databases)
CREATE TABLE IF NOT EXISTS public.categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);
INSERT INTO public.categories (name)
SELECT DISTINCT category FROM public.products WHERE category IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- 2b. Uploaded images (product + variant photos), served publicly at /media/<id>.jpg
CREATE TABLE IF NOT EXISTS public.media (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL,
  data         bytea NOT NULL,
  bytes        integer NOT NULL,
  width        integer,
  height       integer,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 3. Uniqueness + performance indexes (skipped quietly if existing data has duplicates)
DO $m$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_key ON public.customers (phone);
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'customers.phone has duplicates - unique index skipped';
END $m$;
DO $m$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS product_variants_product_size_color_key ON public.product_variants (product_id, size, color);
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'duplicate variants - unique index skipped';
END $m$;
DO $m$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS products_sku_key ON public.products (sku) WHERE sku IS NOT NULL AND sku <> '';
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'duplicate product SKUs - unique index skipped';
END $m$;
CREATE INDEX IF NOT EXISTS idx_orders_phone_created ON public.orders (customer_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variant ON public.order_items (variant_id);
CREATE INDEX IF NOT EXISTS idx_variants_product ON public.product_variants (product_id);

-- 4. updated_at helper for products / customers / store_settings
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$fn$;
DROP TRIGGER IF EXISTS trg_products_touch ON public.products;
CREATE TRIGGER trg_products_touch BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_customers_touch ON public.customers;
CREATE TRIGGER trg_customers_touch BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_store_settings_touch ON public.store_settings;
CREATE TRIGGER trg_store_settings_touch BEFORE UPDATE ON public.store_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Order pricing: delivery fee + free-delivery threshold now come from store_settings
CREATE OR REPLACE FUNCTION public.orders_before_insert()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  v_item      jsonb;
  v_variant   record;
  v_qty       integer;
  v_subtotal  integer := 0;
  v_cust_id   uuid;
  v_cust_addr text;
  v_fee       integer;
  v_free_from integer;
BEGIN
  IF jsonb_typeof(NEW.items) = 'string' THEN
    NEW.items := (NEW.items #>> '{}')::jsonb;
  END IF;
  IF NEW.items IS NULL OR jsonb_typeof(NEW.items) <> 'array' OR jsonb_array_length(NEW.items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item: [{"variant_id":"...","qty":1}]';
  END IF;

  SELECT id, address INTO v_cust_id, v_cust_addr FROM public.customers WHERE phone = NEW.customer_phone;
  NEW.customer_id := COALESCE(NEW.customer_id, v_cust_id);
  NEW.delivery_address := COALESCE(NULLIF(trim(NEW.delivery_address), ''), v_cust_addr);

  FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
    v_qty := COALESCE((v_item->>'qty')::int, 1);
    IF v_qty <= 0 THEN RAISE EXCEPTION 'Quantity must be at least 1'; END IF;

    SELECT v.id, v.size, v.color, v.stock_qty, v.is_active AS v_active, p.name, p.is_active AS p_active,
           p.price_cents + COALESCE(v.extra_price_cents, 0) AS unit_price
      INTO v_variant
      FROM public.product_variants v
      JOIN public.products p ON p.id = v.product_id
     WHERE v.id = (v_item->>'variant_id')::uuid
       FOR UPDATE OF v;

    IF NOT FOUND OR NOT v_variant.v_active OR NOT v_variant.p_active THEN
      RAISE EXCEPTION 'Variant % is not available', v_item->>'variant_id';
    END IF;
    IF v_variant.stock_qty < v_qty THEN
      RAISE EXCEPTION 'Only % left of % (%/%)', v_variant.stock_qty, v_variant.name, v_variant.size, v_variant.color;
    END IF;
    v_subtotal := v_subtotal + v_variant.unit_price * v_qty;
  END LOOP;

  SELECT delivery_fee_cents, free_delivery_threshold_cents INTO v_fee, v_free_from FROM public.store_settings WHERE id = 1;
  v_fee := COALESCE(v_fee, 35000);
  v_free_from := COALESCE(v_free_from, 1000000);

  NEW.subtotal_cents     := v_subtotal;
  NEW.delivery_fee_cents := CASE WHEN v_free_from > 0 AND v_subtotal >= v_free_from THEN 0 ELSE v_fee END;
  NEW.total_cents        := NEW.subtotal_cents + NEW.delivery_fee_cents;
  NEW.order_no           := 'ORD-' || to_char(now() AT TIME ZONE 'Asia/Colombo', 'YYMMDD') || '-' || lpad(nextval('public.order_no_seq')::text, 4, '0');
  NEW.status             := COALESCE(NEW.status, 'pending');
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.orders_after_insert()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  INSERT INTO public.order_items (order_id, variant_id, product_name, size, color, qty, unit_price_cents, line_total_cents)
  SELECT NEW.id, v.id, p.name, v.size, v.color,
         COALESCE((it->>'qty')::int, 1),
         p.price_cents + COALESCE(v.extra_price_cents, 0),
         (p.price_cents + COALESCE(v.extra_price_cents, 0)) * COALESCE((it->>'qty')::int, 1)
    FROM jsonb_array_elements(NEW.items) it
    JOIN public.product_variants v ON v.id = (it->>'variant_id')::uuid
    JOIN public.products p ON p.id = v.product_id;

  UPDATE public.product_variants v
     SET stock_qty = v.stock_qty - x.qty
    FROM (SELECT (it->>'variant_id')::uuid AS variant_id, SUM(COALESCE((it->>'qty')::int, 1)) AS qty
            FROM jsonb_array_elements(NEW.items) it GROUP BY 1) x
   WHERE v.id = x.variant_id;
  RETURN NULL;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.orders_on_update()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    UPDATE public.product_variants v
       SET stock_qty = v.stock_qty + oi.qty
      FROM (SELECT variant_id, SUM(qty) AS qty FROM public.order_items WHERE order_id = NEW.id GROUP BY variant_id) oi
     WHERE v.id = oi.variant_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

-- Replace any older order triggers with the three above
DROP TRIGGER IF EXISTS orders_set_order_no       ON public.orders;
DROP TRIGGER IF EXISTS orders_create_order_items ON public.orders;
DROP TRIGGER IF EXISTS trg_orders_on_cancel      ON public.orders;
DROP TRIGGER IF EXISTS trg_orders_before_insert  ON public.orders;
DROP TRIGGER IF EXISTS trg_orders_after_insert   ON public.orders;
DROP TRIGGER IF EXISTS trg_orders_on_update      ON public.orders;
CREATE TRIGGER trg_orders_before_insert BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.orders_before_insert();
CREATE TRIGGER trg_orders_after_insert  AFTER INSERT  ON public.orders FOR EACH ROW EXECUTE FUNCTION public.orders_after_insert();
CREATE TRIGGER trg_orders_on_update     BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.orders_on_update();
`;
