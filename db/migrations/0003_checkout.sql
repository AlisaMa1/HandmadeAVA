-- HandmadeAVA — cash-on-delivery checkout (MVP step 3)
--
-- ADDITIVE ONLY. 0001_init.sql already created `orders` / `order_items` with the
-- columns a guest order needs (customer_name, customer_phone, delivery_line1/2,
-- delivery_city, delivery_postal, delivery_country, notes, subtotal, delivery_cost,
-- total, status, payment_method, order_number) and `profile_id` nullable, so a guest
-- order is stored without an account. This migration adds the three things checkout
-- needs on top of that.
--
-- Run with:  bun run db:migrate   (applies 0001 → 0002 → 0003, in that order)
--
-- ORDER NUMBERS
--   `AVA-<year>-<4-digit sequence>`, e.g. AVA-2026-0001. The sequence below is the
--   single source of truth so two simultaneous checkouts can never produce the same
--   number; `orders.order_number` is already UNIQUE (0001), which is the backstop.
--
-- VIEW TOKENS
--   32 random bytes, hex-encoded, generated server-side per order. The confirmation
--   URL is /porosia/<view_token> — never a sequential id, so it cannot be enumerated.
--   The token is the only secret needed to read that one order.
--
-- IDEMPOTENCY KEYS
--   The browser sends a random key with each checkout attempt. A repeated submit
--   (double click, retry, flaky network) returns the order that already exists instead
--   of charging the customer twice / shipping twice. Partial unique index so that
--   historical rows without a key still fit.
-- ------------------------------------------------------------------ sequence ---
create sequence if not exists order_number_seq start with 1 increment by 1;
-- Any order that somehow predates the sequence must not collide with it later. On a
-- fresh install `orders` is empty, so this does nothing and numbering starts at 1.
select setval('order_number_seq', s.m, true)
from (
  select max((regexp_match(order_number, '([0-9]+)
-- -------------------------------------------------------------------- columns ---
alter table orders add column if not exists view_token text;
alter table orders add column if not exists idempotency_key text;
create unique index if not exists orders_view_token_key on orders (view_token);
create unique index if not exists orders_idempotency_key_idx
  on orders (idempotency_key) where idempotency_key is not null;
-- The admin panel and the customer's own history both sort by date.
create index if not exists orders_created_idx on orders (created_at desc);
-- --------------------------------------------------------------------- notes ---
-- Stock is decremented inside the same statement that inserts the order (see
-- src/server/checkout.ts). Product-level stock is used for a line without a variant;
-- variant-level stock is used for a line with one. `cancel` of an order does NOT
-- restock automatically — that stays a deliberate admin action in a later step.
))[1]::bigint) as m
  from orders
  where order_number ~ '[0-9]+
-- -------------------------------------------------------------------- columns ---
alter table orders add column if not exists view_token text;
alter table orders add column if not exists idempotency_key text;
create unique index if not exists orders_view_token_key on orders (view_token);
create unique index if not exists orders_idempotency_key_idx
  on orders (idempotency_key) where idempotency_key is not null;
-- The admin panel and the customer's own history both sort by date.
create index if not exists orders_created_idx on orders (created_at desc);
-- --------------------------------------------------------------------- notes ---
-- Stock is decremented inside the same statement that inserts the order (see
-- src/server/checkout.ts). Product-level stock is used for a line without a variant;
-- variant-level stock is used for a line with one. `cancel` of an order does NOT
-- restock automatically — that stays a deliberate admin action in a later step.

) s
where s.m is not null;
-- -------------------------------------------------------------------- columns ---
alter table orders add column if not exists view_token text;
alter table orders add column if not exists idempotency_key text;
create unique index if not exists orders_view_token_key on orders (view_token);
create unique index if not exists orders_idempotency_key_idx
  on orders (idempotency_key) where idempotency_key is not null;
-- The admin panel and the customer's own history both sort by date.
create index if not exists orders_created_idx on orders (created_at desc);
-- --------------------------------------------------------------------- notes ---
-- Stock is decremented inside the same statement that inserts the order (see
-- src/server/checkout.ts). Product-level stock is used for a line without a variant;
-- variant-level stock is used for a line with one. `cancel` of an order does NOT
-- restock automatically — that stays a deliberate admin action in a later step.
