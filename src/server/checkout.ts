/**
 * Cash-on-delivery checkout — the only place orders are created.
 *
 * ─── SECURITY CONTRACT ─────────────────────────────────────────────────────────────
 * The browser cart lives in localStorage and is therefore UNTRUSTED. `placeOrder`
 * accepts only `{ items: [{ productId, variantId?, quantity }], customer, address,
 * idempotencyKey }` — never a price, a subtotal, a delivery cost, a total or a stock
 * level. Everything money- and stock-related is re-read from Postgres inside ONE
 * statement (Postgres runs a single statement as one transaction, so the row locks,
 * the checks, the inserts and the stock decrements either all happen or none do):
 *
 *   1. `for update` row locks on every product (and variant) in the cart.
 *   2. unit price = COALESCE(sale_price, price) + COALESCE(variant price_delta, 0)
 *   3. available stock = the variant's stock when a variant was chosen, else the
 *      product's stock.
 *   4. delivery cost and the free-delivery threshold come from `store_settings`.
 *   5. any line with a missing/inactive product, a missing variant, insufficient stock
 *      or quantity > 10 aborts the whole order with an Albanian message naming the
 *      piece — nothing is written.
 *   6. the order and its items are inserted with name / variant / unit-price SNAPSHOTS
 *      and stock is decremented.
 *
 * Idempotency: the client sends a random key. A repeated submit finds the existing
 * order (unique index on `orders.idempotency_key`) and returns it instead of creating a
 * second one; a concurrent double submit that slips past the check is caught as a
 * unique violation and resolved to the same order.
 *
 * Payment: cash on delivery only. There is no payment gateway, so nothing here can
 * honestly claim money was received — `orders.status` starts at 'pending'.
 */
import { randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { ORDER_STATUS_LABEL } from "~/server/accounts";
import { getCurrentUser } from "~/server/auth";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[0-9a-f]{64}$/;

const MAX_LINES = 20;
const MAX_QTY_PER_LINE = 10;
const MAX_ITEMS_PER_ORDER = 50;

export const DELIVERY_NOTE =
  "Dërgesa kryhet brenda 2–4 ditëve pune në të gjithë Shqipërinë. Porositë mbi pragun e dërgesës falas nuk paguajnë transport.";

export type OrderLineInput = { productId: string; variantId?: string | null; quantity: number };

export type PlaceOrderInput = {
  items: OrderLineInput[];
  customer: { name: string; phone: string; email?: string | null };
  address: {
    line1: string;
    line2?: string | null;
    city: string;
    postalCode?: string | null;
    country?: string | null;
    notes?: string | null;
  };
  idempotencyKey: string;
};

export type PlacedOrder = {
  token: string;
  orderNumber: string;
  subtotal: string;
  deliveryCost: string;
  total: string;
  createdAt: string;
};

export type PlaceOrderResult = { ok: true; order: PlacedOrder } | { ok: false; error: string };

/** Collapse whitespace, drop control characters and cap the length. */
function clean(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function validatePhone(raw: string): string | null {
  const phone = clean(raw, 24);
  if (phone.length < 6) return "Ju lutem shkruani numrin e telefonit.";
  if (!/^[+0-9][0-9 ()/-]*$/.test(phone)) return "Numri i telefonit mund të përmbajë vetëm numra, hapësira dhe shenjën +.";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return "Numri i telefonit nuk duket i saktë. Shembull: +355 69 123 4567.";
  return null;
}

/** Validate and normalise the whole payload. Returns a clear Albanian error per field. */
function prepare(input: PlaceOrderInput) {
  const items = (Array.isArray(input?.items) ? input.items : [])
    .map((line) => ({
      productId: String(line?.productId ?? ""),
      variantId: line?.variantId ? String(line.variantId) : null,
      quantity: Math.floor(Number(line?.quantity ?? 0)),
    }))
    .filter((line) => UUID_RE.test(line.productId));

  if (items.length === 0) throw new Error("Shporta është bosh — shtoni të paktën një pjesë para se të porositni.");
  if (items.length > MAX_LINES) throw new Error(`Një porosi mund të përmbajë deri në ${MAX_LINES} rreshta të ndryshëm.`);
  for (const line of items) {
    if (!Number.isFinite(line.quantity) || line.quantity < 1) throw new Error("Sasia e një pjesë duhet të jetë të paktën 1.");
    if (line.quantity > MAX_QTY_PER_LINE) throw new Error(`Sasia për një pjesë nuk mund të kalojë ${MAX_QTY_PER_LINE} copë.`);
    if (line.variantId && !UUID_RE.test(line.variantId)) throw new Error("Një variant i zgjedhur nuk është i vlefshëm.");
  }
  if (items.reduce((sum, l) => sum + l.quantity, 0) > MAX_ITEMS_PER_ORDER)
    throw new Error(`Një porosi mund të përmbajë deri në ${MAX_ITEMS_PER_ORDER} copë.`);

  const name = clean(input?.customer?.name, 80);
  if (name.length < 3) throw new Error("Ju lutem shkruani emrin dhe mbiemrin tuaj.");
  const phoneError = validatePhone(input?.customer?.phone ?? "");
  if (phoneError) throw phoneError;
  const phone = clean(input?.customer?.phone, 24);
  const email = clean(input?.customer?.email, 160);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Adresa e emailit nuk duket e saktë.");

  const line1 = clean(input?.address?.line1, 200);
  if (line1.length < 5) throw new Error("Ju lutem shkruani adresën e plotë (rruga dhe numri).");
  const city = clean(input?.address?.city, 80);
  if (city.length < 2) throw new Error("Ju lutem shkruani qytetin.");
  const postal = clean(input?.address?.postalCode, 10);
  if (postal && !/^[0-9]{3,6}$/.test(postal)) throw new Error("Kodi postar duhet të përmbajë vetëm numra (p.sh. 1001).");
  const country = (clean(input?.address?.country, 2) || "AL").toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new Error("Ju lutem zgjidhni vendin.");
  const line2 = clean(input?.address?.line2, 200) || null;
  const notes = clean(input?.address?.notes, 500) || null;

  const key = clean(input?.idempotencyKey, 64);
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(key)) throw new Error("Kërkesa e porosisë nuk është e vlefshme. Rifreskoni faqen dhe provoni përsëri.");

  return {
    items,
    customer: { name, phone, email: email || null },
    address: { line1, line2, city, postal: postal || null, country, notes },
    idempotencyKey: key,
  };
}

type OrderJson = {
  id: string;
  orderNumber: string;
  token: string;
  subtotal: string;
  deliveryCost: string;
  total: string;
  createdAt: string;
};

type StatementResult = {
  ok: boolean;
  reused: boolean;
  message: string | null;
  order: OrderJson | null;
  existing: OrderJson | null;
};

/**
 * Load one order by its unguessable view token. Returns { found: false } for a missing,
 * malformed or unknown token — never an error that would reveal whether a token exists.
 */
export type OrderViewItem = {
  name: string;
  variant: string | null;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
};

export type OrderView = {
  dbReady: boolean;
  found: boolean;
  order: {
    orderNumber: string;
    status: string;
    statusLabel: string;
    createdAt: string;
    customerName: string;
    customerPhone: string;
    addressLines: string[];
    notes: string | null;
    subtotal: string;
    deliveryCost: string;
    total: string;
    paymentMethod: "cash_on_delivery";
    isOwner: boolean;
  } | null;
  items: OrderViewItem[];
};

const DB_DOWN =
  "Porosia nuk u regjistrua sepse shërbimi i porosive nuk është i lidhur me bazën e të dhënave. Provoni përsëri pas pak.";

/** Place a real order. Server-side prices, stock and totals only. */
export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((input: PlaceOrderInput) => input)
  .handler(async ({ data }): Promise<PlaceOrderResult> => {
    let prepared: ReturnType<typeof prepare>;
    try {
      prepared = prepare(data);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Porosia nuk mund të dërgohet." };
    }

    const user = await getCurrentUser().catch(() => null);
    const viewToken = randomBytes(32).toString("hex");
    const itemsJson = JSON.stringify(
      prepared.items.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity }))
    );

    try {
      const rows = (await sql()`
        with input as (
          select (e->>'productId')::uuid as product_id,
                 nullif(e->>'variantId', '')::uuid as variant_id,
                 (e->>'quantity')::int as quantity
          from jsonb_array_elements(${itemsJson}::jsonb) as e
        ),
        dedup as (
          select product_id, variant_id, sum(quantity)::int as quantity
          from input group by product_id, variant_id
        ),
        locked_products as (
          select p.id, p.name_sq, p.price_eur, p.sale_price_eur, p.is_active, p.stock_quantity
          from products p
          where p.id in (select product_id from dedup)
          for update
        ),
        locked_variants as (
          select v.id, v.product_id, v.value_sq, v.price_delta, v.stock_quantity
          from product_variants v
          where v.id in (select variant_id from dedup where variant_id is not null)
          for update
        ),
        existing as (
          select o.id, o.order_number, o.view_token, o.subtotal, o.delivery_cost, o.total, o.created_at
          from orders o
          where o.idempotency_key = ${prepared.idempotencyKey}
          for update
        ),
        lines as (
          select d.product_id, d.variant_id, d.quantity,
                 (p.id is not null) as product_found,
                 (p.id is not null and (d.variant_id is null or v.id is not null)) as variant_ok,
                 coalesce(p.is_active, false) as is_active,
                 p.name_sq,
                 v.value_sq as variant_value,
                 round(coalesce(p.sale_price_eur, p.price_eur) + coalesce(v.price_delta, 0), 2) as unit_price,
                 greatest(coalesce(case when d.variant_id is null then p.stock_quantity else v.stock_quantity end, 0), 0) as stock_available
          from dedup d
          left join locked_products p on p.id = d.product_id
          left join locked_variants v on v.id = d.variant_id and v.product_id = d.product_id
        ),
        problems as (
          select string_agg(msg, ' ' order by seq) as message
          from (
            select 1 as seq, 'Një pjesë në shportë nuk gjendet më në dyqan.' as msg
            from lines where not product_found or not variant_ok
            union all
            select 2, '«' || name_sq || '» nuk është më në shitje.'
            from lines where product_found and variant_ok and not is_active
            union all
            select 3,
              case when stock_available <= 0
                   then '«' || name_sq || '» është e mbaruar nga stoku.'
                   else 'Kemi vetëm ' || stock_available || ' copë të «' || name_sq || '» — ju lutem zvogëloni sasinë.' end
            from lines
            where product_found and variant_ok and is_active and (stock_available <= 0 or quantity > stock_available)
            union all
            select 4, 'Sasia për një pjesë nuk mund të kalojë 10 copë.'
            from lines where quantity > 10
            union all
            select 5, 'Një porosi mund të përmbajë deri në 50 copë.'
            from (select coalesce(sum(quantity), 0) as n from lines) t where t.n > 50
          ) x
        ),
        valid_lines as (
          select * from lines
          where product_found and variant_ok and is_active
            and quantity > 0 and quantity <= 10 and quantity <= stock_available
        ),
        counts as (
          select (select count(*) from lines)::int as n_lines,
                 (select count(*) from valid_lines)::int as n_valid,
                 (select coalesce(sum(quantity), 0) from valid_lines)::int as n_items
        ),
        totals as (
          select coalesce(sum(unit_price * quantity), 0)::numeric(10,2) as subtotal from valid_lines
        ),
        settings as (
          select coalesce(nullif((select value from store_settings where key = 'delivery_cost_eur'), '')::numeric, 4.90)::numeric(10,2) as delivery_cost,
                 coalesce(nullif((select value from store_settings where key = 'free_delivery_threshold_eur'), '')::numeric, 60.00)::numeric(10,2) as threshold
        ),
        money as (
          select t.subtotal,
                 (case when s.threshold > 0 and t.subtotal >= s.threshold then 0 else s.delivery_cost end)::numeric(10,2) as delivery_cost,
                 (t.subtotal + case when s.threshold > 0 and t.subtotal >= s.threshold then 0 else s.delivery_cost end)::numeric(10,2) as total
          from totals t cross join settings s
        ),
        gate as (
          select 1 as ok
          where (select message from problems) is null
            and (select n_lines from counts) > 0
            and (select n_valid from counts) = (select n_lines from counts)
            and (select n_items from counts) <= 50
            and (select subtotal from money) > 0
            and not exists (select 1 from existing)
        ),
        new_order as (
          insert into orders (
            order_number, profile_id, status, payment_method,
            customer_name, customer_phone, customer_email,
            delivery_line1, delivery_line2, delivery_city, delivery_postal, delivery_country, notes,
            subtotal, delivery_cost, total, view_token, idempotency_key
          )
          select
            'AVA-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('order_number_seq')::text, 4, '0'),
            ${user?.id ?? null}::uuid,
            'pending',
            'cash_on_delivery',
            ${prepared.customer.name},
            ${prepared.customer.phone},
            ${prepared.customer.email},
            ${prepared.address.line1},
            ${prepared.address.line2},
            ${prepared.address.city},
            ${prepared.address.postal},
            ${prepared.address.country},
            ${prepared.address.notes},
            m.subtotal, m.delivery_cost, m.total, ${viewToken}, ${prepared.idempotencyKey}
          from gate, money m
          returning id, order_number, subtotal, delivery_cost, total, created_at
        ),
        new_items as (
          insert into order_items (order_id, product_id, variant_id, name_snapshot, variant_snapshot, unit_price, quantity)
          select o.id, l.product_id, l.variant_id, l.name_sq, l.variant_value, l.unit_price, l.quantity
          from new_order o cross join valid_lines l
          returning 1 as x
        ),
        stock_products as (
          update products p
             set stock_quantity = greatest(p.stock_quantity - d.qty, 0), updated_at = now()
            from (select product_id, sum(quantity)::int as qty from valid_lines
                   where variant_id is null group by product_id) d, gate
           where p.id = d.product_id
          returning 1 as x
        ),
        stock_variants as (
          update product_variants v
             set stock_quantity = greatest(v.stock_quantity - d.qty, 0)
            from (select variant_id, sum(quantity)::int as qty from valid_lines
                   where variant_id is not null group by variant_id) d, gate
           where v.id = d.variant_id
          returning 1 as x
        )
        select jsonb_build_object(
          'ok', (select count(*) from new_order) > 0,
          'reused', (select count(*) from existing) > 0,
          'message', (select message from problems),
          'order', (select jsonb_build_object(
                      'id', id, 'orderNumber', order_number, 'token', ${viewToken},
                      'subtotal', subtotal::text, 'deliveryCost', delivery_cost::text,
                      'total', total::text, 'createdAt', created_at) from new_order),
          'existing', (select jsonb_build_object(
                      'id', id, 'orderNumber', order_number, 'token', view_token,
                      'subtotal', subtotal::text, 'deliveryCost', delivery_cost::text,
                      'total', total::text, 'createdAt', created_at) from existing)
        ) as result
      `) as { result: StatementResult }[];

      const result = rows[0]?.result;
      if (!result) return { ok: false, error: "Porosia nuk u regjistrua. Provoni përsëri." };

      const order = result.order ?? result.existing;
      if (order) {
        return {
          ok: true,
          order: {
            token: order.token,
            orderNumber: order.orderNumber,
            subtotal: String(order.subtotal),
            deliveryCost: String(order.deliveryCost),
            total: String(order.total),
            createdAt: String(order.createdAt),
          },
        };
      }
      return {
        ok: false,
        error: result.message ?? "Porosia nuk u regjistrua: disa pjesë nuk janë më të disponueshme.",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // A concurrent double submit slipped past the `existing` check: the unique index on
      // idempotency_key rejected the second insert. Return the order that did get created.
      if (/orders_idempotency_key_idx|duplicate key/i.test(message)) {
        try {
          const rows = (await sql()`
            select order_number, view_token, subtotal::text as subtotal,
                   delivery_cost::text as delivery_cost, total::text as total, created_at
            from orders where idempotency_key = ${prepared.idempotencyKey} limit 1
          `) as { order_number: string; view_token: string; subtotal: string; delivery_cost: string; total: string; created_at: string }[];
          const row = rows[0];
          if (row) {
            return {
              ok: true,
              order: {
                token: row.view_token,
                orderNumber: row.order_number,
                subtotal: String(row.subtotal),
                deliveryCost: String(row.delivery_cost),
                total: String(row.total),
                createdAt: String(row.created_at),
              },
            };
          }
        } catch {
          /* fall through to the honest error below */
        }
      }
      console.error("[checkout] placeOrder failed:", message);
      return { ok: false, error: DB_DOWN };
    }
  });

/** The confirmation page: one order, addressed by its unguessable view token. */
export const getOrderByToken = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => ({ token: String(input?.token ?? "").toLowerCase() }))
  .handler(async ({ data }): Promise<OrderView> => {
    const empty: OrderView = { dbReady: false, found: false, order: null, items: [] };
    if (!TOKEN_RE.test(data.token)) return { ...empty, dbReady: true };

    let rows: Record<string, unknown>[];
    try {
      rows = (await sql()`
        select o.id, o.order_number, o.status, o.created_at, o.customer_name, o.customer_phone,
               o.delivery_line1, o.delivery_line2, o.delivery_city, o.delivery_postal, o.delivery_country,
               o.notes, o.subtotal::text as subtotal, o.delivery_cost::text as delivery_cost,
               o.total::text as total, o.payment_method, o.profile_id
        from orders o
        where o.view_token = ${data.token}
        limit 1
      `) as Record<string, unknown>[];
    } catch (error) {
      console.error("[checkout] getOrderByToken failed:", error instanceof Error ? error.message : error);
      return empty;
    }

    const row = rows[0];
    if (!row) return { ...empty, dbReady: true };

    const items = (await sql()`
      select name_snapshot, variant_snapshot, unit_price::text as unit_price, quantity
      from order_items where order_id = ${String(row.id)}
      order by created_at asc, name_snapshot asc
    `) as { name_snapshot: string; variant_snapshot: string | null; unit_price: string; quantity: number }[];

    const user = await getCurrentUser().catch(() => null);
    const status = String(row.status);
    const addressLines = [
      String(row.delivery_line1),
      row.delivery_line2 ? String(row.delivery_line2) : null,
      [row.delivery_postal ? String(row.delivery_postal) : null, String(row.delivery_city)].filter(Boolean).join(" "),
      String(row.delivery_country),
    ].filter((l): l is string => Boolean(l && l.length));

    return {
      dbReady: true,
      found: true,
      order: {
        orderNumber: String(row.order_number),
        status,
        statusLabel: ORDER_STATUS_LABEL[status] ?? status,
        createdAt: String(row.created_at),
        customerName: String(row.customer_name),
        customerPhone: String(row.customer_phone),
        addressLines,
        notes: row.notes ? String(row.notes) : null,
        subtotal: String(row.subtotal),
        deliveryCost: String(row.delivery_cost),
        total: String(row.total),
        paymentMethod: "cash_on_delivery",
        isOwner: Boolean(user && row.profile_id === user.id),
      },
      items: items.map((i) => ({
        name: String(i.name_snapshot),
        variant: i.variant_snapshot ? String(i.variant_snapshot) : null,
        quantity: Number(i.quantity),
        unitPrice: String(i.unit_price),
        lineTotal: (Number(i.unit_price) * Number(i.quantity)).toFixed(2),
      })),
    };
  });

export type CheckoutPrefill = {
  signedIn: boolean;
  name: string;
  phone: string;
  email: string;
  line1: string;
  line2: string;
  city: string;
  postalCode: string;
  country: string;
  deliveryCost: string;
  freeDeliveryThreshold: string;
};

/** Prefill the checkout form for a signed-in customer (name, phone, default address). */
export const getCheckoutPrefill = createServerFn({ method: "GET" }).handler(
  async (): Promise<CheckoutPrefill> => {
    const base: CheckoutPrefill = {
      signedIn: false,
      name: "",
      phone: "",
      email: "",
      line1: "",
      line2: "",
      city: "",
      postalCode: "",
      country: "AL",
      deliveryCost: "4.90",
      freeDeliveryThreshold: "60.00",
    };
    try {
      const settings = (await sql()`
        select key, value from store_settings
        where key in ('delivery_cost_eur', 'free_delivery_threshold_eur')
      `) as { key: string; value: string }[];
      for (const s of settings) {
        if (s.key === "delivery_cost_eur" && s.value) base.deliveryCost = s.value;
        if (s.key === "free_delivery_threshold_eur" && s.value) base.freeDeliveryThreshold = s.value;
      }
    } catch {
      /* keep the documented defaults */
    }

    const user = await getCurrentUser().catch(() => null);
    if (!user) return base;

    type AddressRow = {
      full_name: string;
      phone: string;
      line1: string;
      line2: string | null;
      city: string;
      postal_code: string | null;
      country: string;
    };
    let address: AddressRow | undefined;
    try {
      const rows = (await sql()`
        select full_name, phone, line1, line2, city, postal_code, country
        from addresses where profile_id = ${user.id}
        order by is_default desc, created_at asc
        limit 1
      `) as AddressRow[];
      address = rows[0];
    } catch {
      address = undefined;
    }

    return {
      ...base,
      signedIn: true,
      name: address?.full_name ?? user.fullName ?? "",
      phone: address?.phone ?? user.phone ?? "",
      email: user.email ?? "",
      line1: address?.line1 ?? "",
      line2: address?.line2 ?? "",
      city: address?.city ?? "",
      postalCode: address?.postal_code ?? "",
      country: address?.country ?? "AL",
    };
  }
);
