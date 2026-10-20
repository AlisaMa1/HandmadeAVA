-- HandmadeAVA — initial schema (MVP step 1)
--
-- AUTHORIZATION MODEL: this application enforces access control in SERVER CODE, NOT
-- with Postgres row-level security. The app connects to Neon with the database owner
-- role (DATABASE_URL), so RLS policies would never constrain it. Every read and write
-- therefore goes through a `createServerFn()` or an `src/routes/api/*` route that
-- checks the caller's role and ownership before touching the database. Never expose
-- a table directly to the browser.
--
-- Run with:  bun run db:migrate

create extension if not exists "pgcrypto";

-- Shared trigger to keep updated_at honest.
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------- catalogue ---

create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name_sq     text not null,
  description text,
  image_url   text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint categories_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
create index if not exists categories_active_idx on categories (is_active, sort_order);

create table if not exists products (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name_sq         text not null,
  description_sq  text,
  price_eur       numeric(10,2) not null,
  sale_price_eur  numeric(10,2),
  sku             text unique,
  stock_quantity  integer not null default 0,
  category_id     uuid not null references categories (id) on delete restrict,
  is_active       boolean not null default true,
  is_featured     boolean not null default false,
  is_new_arrival  boolean not null default false,
  is_best_seller  boolean not null default false,
  -- Marks illustrative sample rows seeded for demo purposes. The owner clears these
  -- when real products and photos replace the placeholders.
  is_sample       boolean not null default false,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint products_price_check check (price_eur > 0),
  constraint products_sale_price_check check (sale_price_eur is null or (sale_price_eur > 0 and sale_price_eur < price_eur)),
  constraint products_stock_check check (stock_quantity >= 0),
  constraint products_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
create index if not exists products_category_idx on products (category_id);
create index if not exists products_active_created_idx on products (is_active, created_at desc);
create index if not exists products_flags_idx on products (is_featured, is_new_arrival, is_best_seller);
create trigger products_updated_at before update on products
  for each row execute function set_updated_at();

create table if not exists product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products (id) on delete cascade,
  url         text not null,
  alt_sq      text,
  sort_order  integer not null default 0,
  is_primary  boolean not null default false,
  is_sample   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists product_images_product_idx on product_images (product_id, sort_order);
create unique index if not exists product_images_one_primary_idx
  on product_images (product_id) where is_primary;

create table if not exists product_variants (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references products (id) on delete cascade,
  kind            text not null check (kind in ('colour', 'size')),
  value_sq        text not null,
  price_delta     numeric(10,2) not null default 0,
  stock_quantity  integer not null default 0 check (stock_quantity >= 0),
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  unique (product_id, kind, value_sq)
);
create index if not exists product_variants_product_idx on product_variants (product_id);

-- ---------------------------------------------------------------- settings ---

create table if not exists store_settings (
  key         text primary key,
  value       text not null default '',
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------ people ---

create table if not exists profiles (
  id                uuid primary key default gen_random_uuid(),
  email             text not null unique,
  password_hash     text not null,
  full_name         text,
  phone             text,
  role              text not null default 'customer' check (role in ('customer', 'admin')),
  status            text not null default 'active' check (status in ('active', 'blocked')),
  email_verified_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

create table if not exists sessions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles (id) on delete cascade,
  token_hash  text not null unique,
  user_agent  text,
  ip_address  text,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists sessions_profile_idx on sessions (profile_id);
create index if not exists sessions_expires_idx on sessions (expires_at);

create table if not exists addresses (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles (id) on delete cascade,
  full_name   text not null,
  phone       text not null,
  line1       text not null,
  line2       text,
  city        text not null,
  postal_code text,
  country     text not null default 'AL',
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists addresses_profile_idx on addresses (profile_id);

-- -------------------------------------------------------------------- carts ---

create table if not exists carts (
  id            uuid primary key default gen_random_uuid(),
  -- Either a signed-in profile owns the cart, or it is an anonymous cart keyed by a
  -- cookie-held token (created in a later step).
  profile_id    uuid references profiles (id) on delete cascade,
  guest_token   text unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint carts_owner_check check (profile_id is not null or guest_token is not null)
);
create trigger carts_updated_at before update on carts
  for each row execute function set_updated_at();

create table if not exists cart_items (
  id          uuid primary key default gen_random_uuid(),
  cart_id     uuid not null references carts (id) on delete cascade,
  product_id  uuid not null references products (id) on delete cascade,
  variant_id  uuid references product_variants (id) on delete set null,
  quantity    integer not null check (quantity > 0),
  created_at  timestamptz not null default now(),
  unique (cart_id, product_id, variant_id)
);
create index if not exists cart_items_cart_idx on cart_items (cart_id);

-- ------------------------------------------------------------------- orders ---

create table if not exists orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      text not null unique,
  profile_id        uuid references profiles (id) on delete set null,
  status            text not null default 'pending'
                    check (status in ('pending','confirmed','processing','shipped','delivered','cancelled')),
  payment_method    text not null default 'cash_on_delivery'
                    check (payment_method in ('cash_on_delivery')),
  customer_name     text not null,
  customer_phone    text not null,
  customer_email    text,
  delivery_line1    text not null,
  delivery_line2    text,
  delivery_city     text not null,
  delivery_postal   text,
  delivery_country  text not null default 'AL',
  notes             text,
  subtotal          numeric(10,2) not null check (subtotal >= 0),
  delivery_cost     numeric(10,2) not null default 0 check (delivery_cost >= 0),
  total             numeric(10,2) not null check (total >= 0),
  tracking_number   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists orders_status_created_idx on orders (status, created_at desc);
create index if not exists orders_profile_idx on orders (profile_id, created_at desc);

create trigger orders_updated_at before update on orders
  for each row execute function set_updated_at();

create table if not exists order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders (id) on delete cascade,
  product_id      uuid references products (id) on delete set null,
  variant_id      uuid references product_variants (id) on delete set null,
  name_snapshot   text not null,
  variant_snapshot text,
  unit_price      numeric(10,2) not null check (unit_price >= 0),
  quantity        integer not null check (quantity > 0),
  created_at      timestamptz not null default now()
);
create index if not exists order_items_order_idx on order_items (order_id);

create table if not exists reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products (id) on delete cascade,
  profile_id  uuid references profiles (id) on delete set null,
  author_name text not null,
  rating      integer not null check (rating between 1 and 5),
  body        text,
  is_approved boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists reviews_product_idx on reviews (product_id, is_approved);
