# HandmadeAVA — repository conventions

Albanian-language online store for handmade jewellery. TanStack Start (React + Vite +
Tailwind v4) on the team's site template, Postgres (Neon) for data. Everything the
customer reads is in Albanian.

## Layout

```
db/migrations/       0001_init.sql → 0002_auth.sql → 0003_checkout.sql (append-only)
scripts/             migrate.ts, seed.ts, admin-code.ts, reset-code.ts
src/server/          server-only modules: db access, auth, catalogue, checkout
src/routes/          file-based routes (one file = one URL)
src/components/      shared UI + form primitives
src/lib/             client helpers (cart, formatting)
```

## Running it

- `bun run dev` — local dev server.
- `bun run build` — production build; `bunx tsc --noEmit` for types (both must be clean).
- **`bun run publish`** — rebuilds and republishes the live site on **port 3000**. Port
  3000 is the team's only public surface; whatever serves there is the live site.
  A change is not shipped until `bun run publish` succeeds and the affected pages answer
  on `http://localhost:3000`.
- Server log: `.run/server.log` (default template) — check it when a page 500s.

## Database

- `bun run db:migrate` — applies every `db/migrations/*.sql` in name order, once each.
- `bun run db:seed` — seeds categories, sample products, images and `store_settings`
  (idempotent; safe to re-run).
- `bun run db:setup` — migrate then seed.
- `DATABASE_URL` comes from the owner's Secrets page and is read from `process.env` at
  query time. **Never** put it (or any secret) in a `.env` file — `.env` files are not
  published, so a value that only lives there is missing on the live site.
- Migrations are append-only: add `0004_*.sql`, never edit an applied file.
- The site must build and serve with no database: catalogue reads return honest empty
  states, and errors are never replaced with mock data.

## Data access rules

- All DB access lives in `src/server/*` and is exposed through **`createServerFn()`**
  only (or an `src/routes/api/*` route when a REST endpoint is genuinely needed). The
  TanStack Start plugin strips server handlers from the client bundle, so `sql()` and
  `DATABASE_URL` never reach the browser. Never import `~/db` from a component.
- Return only primitives from server functions: coerce `Date`/`numeric` with `String()`
  or `::text`, or React will refuse to render them.
- Every protected handler starts with `requireUser()` / `requireAdmin()`, and every query
  is scoped by the **session** user id — never an id sent by the browser.
- Anything that arrives from the browser is untrusted input. Prices, totals, delivery
  cost and stock are **always** re-read from Postgres server-side; the localStorage cart
  only ever contributes product ids, variant ids and quantities.
- There is no email capability: never write copy that claims a message was sent.
- Orders are cash on delivery. Never display a "payment received/successful" message, an
  invented delivery date or a tracking number.

## Checkout (`src/server/checkout.ts`)

One statement does everything, so Postgres gives it a single transaction: `for update`
locks → price/stock recompute → `store_settings` delivery cost → validation errors
(Albanian, naming the piece) → insert order + `order_items` snapshots → decrement stock.
Order numbers are `AVA-<year>-<sequence>` (`order_number_seq`); confirmation URLs are
`/porosia/<view_token>` where the token is 32 random bytes, never a sequential id; a
repeated submit with the same `idempotencyKey` returns the existing order.

## First administrator (one-time, only while no admin exists)

1. With `DATABASE_URL` set, run `bun run admin:code` to mint a one-time setup code
   (or set `ADMIN_SETUP_TOKEN` on the Secrets page).
2. Open `/admin/setup`, enter the code and the owner's admin email + password.
3. The page accepts a code **only while the database has zero admin profiles**; after
   the first admin exists it closes itself. Codes are single-use and expire.
4. If the owner loses the admin password: `bun run reset:code` prints a one-time reset
   code to use on `/rivendos-fjalekalimin`.

## Delivery process

1. Branch off `main` (`feat/…`, `fix/…`).
2. Work in `/home/team/shared/site`; keep the site building and serving throughout.
3. Commit, push, and open a **PR against `main`** with a short description of what
   changed and how it was verified. Include the PR URL in your report.
4. After merge, publish and leave the working tree on `main`, clean.
