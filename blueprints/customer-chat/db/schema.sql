-- The orders table Chat reads. Point it at your own table instead by
-- editing the SELECT in pipelines/chat.halo; keep the customer_id filter.
CREATE TABLE IF NOT EXISTS orders (
  id               text PRIMARY KEY,
  customer_id      text NOT NULL,
  status           text NOT NULL CHECK (status IN ('processing', 'shipped', 'delivered', 'cancelled', 'returned')),
  total_cents      integer NOT NULL,
  currency         text NOT NULL DEFAULT 'GBP',
  placed_at        timestamptz NOT NULL DEFAULT now(),
  shipped_at       timestamptz,
  carrier          text,
  tracking_number  text
);
CREATE INDEX IF NOT EXISTS orders_customer ON orders (customer_id, placed_at DESC);

-- Sample data for trying it out.
INSERT INTO orders (id, customer_id, status, total_cents, currency, placed_at, shipped_at, carrier, tracking_number) VALUES
  ('A-1042', 'cus_dana', 'shipped',    5400, 'GBP', now() - interval '3 days', now() - interval '2 days', 'Royal Mail', 'RM123456789GB'),
  ('A-0977', 'cus_dana', 'delivered',  2200, 'GBP', now() - interval '40 days', now() - interval '39 days', 'DPD', '15501234567890'),
  ('A-1051', 'cus_sam',  'processing', 8900, 'GBP', now() - interval '1 hour', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
