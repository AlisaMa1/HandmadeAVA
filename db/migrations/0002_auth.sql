-- HandmadeAVA — accounts, sessions and first-admin setup (MVP step 2)
--
-- Everything here is ADDITIVE. 0001_init.sql already created `profiles` (with
-- password_hash, role, status, email_verified_at) and `sessions` (with token_hash,
-- expires_at); this migration adds what step 2 needs on top of them.
--
-- Run with:  bun run db:migrate   (applies 0001 then 0002, in that order)
--
-- NOTE ON EMAIL: HandmadeAVA has no email capability at all. `profiles.email_verified_at`
-- is therefore left NULL for every account — we never claim an address was verified and
-- never pretend a message was sent. The owner hands out security codes in person / by
-- phone; see `bun run admin:code` and `bun run reset:code`.

-- --------------------------------------------------- password reset tokens ---
-- Only the SHA-256 hash of a reset token is ever stored, so a database reader cannot
-- mint a working link. Tokens are single-use (`used_at`) and expire (`expires_at`).
create table if not exists password_reset_tokens (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles (id) on delete cascade,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists password_reset_tokens_profile_idx
  on password_reset_tokens (profile_id, created_at desc);
create index if not exists password_reset_tokens_live_idx
  on password_reset_tokens (expires_at) where used_at is null;

-- ------------------------------------------------ first administrator codes ---
-- One-time codes produced by `bun run admin:code`. The `/admin/setup` page accepts a
-- live code (or the ADMIN_SETUP_TOKEN environment variable) ONLY while there are zero
-- admin profiles in the database. Only the hash of a code is stored.
create table if not exists admin_setup_codes (
  id          uuid primary key default gen_random_uuid(),
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists admin_setup_codes_live_idx
  on admin_setup_codes (expires_at) where used_at is null;

-- --------------------------------------------------------------- addresses ---
-- 0001 created `addresses` with an `is_default` flag but no way to keep at most one
-- default per profile and no updated_at. Both are added here.
alter table addresses add column if not exists updated_at timestamptz not null default now();

drop trigger if exists addresses_updated_at on addresses;
create trigger addresses_updated_at before update on addresses
  for each row execute function set_updated_at();

create unique index if not exists addresses_one_default_idx
  on addresses (profile_id) where is_default;

-- Sessions are looked up by the hash of the cookie token on every request; the unique
-- index on token_hash already exists from 0001, so that lookup stays cheap.
