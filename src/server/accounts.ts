/**
 * Account, address, order-history and first-admin server functions.
 *
 * ─── SECURITY CONTRACT ─────────────────────────────────────────────────────────────
 * 1. Every protected handler starts with `requireUser()` (or `requireAdmin()`), and every
 *    query is scoped by `user.id` — the id of the SESSION owner, never an id sent by the
 *    browser. A customer who posts somebody else's address/order id gets zero rows back
 *    and an honest "not found": they can neither read nor write another customer's data.
 * 2. Registration always inserts `role = 'customer'` as a SQL literal. The input validator
 *    picks only the four fields it knows about, so a `role` (or `status`, or `id`) in the
 *    request body is dropped before the handler ever sees it.
 * 3. Email/password errors are generic: the login form never reveals whether an address
 *    is registered.
 * 4. There is NO email capability in this shop. Nothing here ever claims a message was
 *    sent. `profiles.email_verified_at` stays NULL for every account, by design.
 */
import { createServerFn } from "@tanstack/react-start";
import type { Role } from "~/server/auth";
import { sql } from "~/db";
import {
  AUTH_MESSAGES,
  AuthError,
  adminCount,
  envSetupTokenMatches,
  getCurrentUser,
  isDbUnavailable,
  requireUser,
  startSession,
} from "~/server/auth";
import { hashPassword, hashToken, MIN_PASSWORD_LENGTH, verifyPassword } from "~/server/password";

/* ------------------------------------------------------------------ results --- */

export type Ok<T> = { ok: true; data: T };
export type Err = { ok: false; error: string };
export type Result<T = undefined> = Ok<T> | Err;

const GENERIC_ERROR = "Ndodhi një gabim i papritur. Provoni përsëri.";

/** Turn thrown errors (AuthError, dead database, anything) into an Albanian result. */
async function guarded<T>(run: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    if (isDbUnavailable(error)) return { ok: false, error: AUTH_MESSAGES.db_unavailable };
    console.error("[accounts] handler failed:", error instanceof Error ? error.message : error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

/* -------------------------------------------------------------- validation --- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
/** A well-formed scrypt hash whose password nobody knows — used to equalise login timing. */
const DUMMY_HASH = `scrypt$1$32768$8$1$${"00".repeat(16)}$${"00".repeat(64)}`;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown): string {
  return str(value).toLowerCase();
}

function validateEmail(email: string): string | null {
  if (email === "") return "Shkruani adresën tuaj të emailit.";
  if (email.length > 254 || !EMAIL_RE.test(email)) return "Adresa e emailit nuk është e saktë.";
  return null;
}

function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Fjalëkalimi duhet të ketë të paktën ${MIN_PASSWORD_LENGTH} karaktere.`;
  }
  if (password.length > 200) return "Fjalëkalimi është shumë i gjatë.";
  return null;
}

function validateName(name: string): string | null {
  if (name.length < 2) return "Shkruani emrin dhe mbiemrin tuaj.";
  if (name.length > 120) return "Emri është shumë i gjatë.";
  return null;
}

function validatePhone(phone: string, required = false): string | null {
  if (phone === "") return required ? "Shkruani numrin e telefonit." : null;
  if (!/^[+0-9][0-9\s()-]{5,24}$/.test(phone)) return "Numri i telefonit nuk është i saktë.";
  return null;
}

/* -------------------------------------------------------------------- auth --- */

export type RegisterInput = {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
};

export type LoginInput = { email: string; password: string };

export type AuthSuccess = { id: string; email: string; fullName: string | null; role: Role };

/**
 * Create a customer account and sign it in. `role` is a SQL literal — the request body
 * cannot influence it, even if a caller sends `{ role: "admin" }`.
 */
export const registerCustomer = createServerFn({ method: "POST" })
  .inputValidator((input: RegisterInput): RegisterInput => ({
    email: normalizeEmail(input?.email),
    password: typeof input?.password === "string" ? input.password : "",
    fullName: str(input?.fullName),
    phone: str(input?.phone),
  }))
  .handler(async ({ data }): Promise<Result<AuthSuccess>> =>
    guarded(async () => {
      const emailError = validateEmail(data.email);
      if (emailError) return { ok: false, error: emailError };
      const passwordError = validatePassword(data.password);
      if (passwordError) return { ok: false, error: passwordError };
      const nameError = validateName(data.fullName);
      if (nameError) return { ok: false, error: nameError };
      const phoneError = validatePhone(data.phone ?? "");
      if (phoneError) return { ok: false, error: phoneError };

      const passwordHash = await hashPassword(data.password);
      const rows = (await sql()`
        insert into profiles (email, password_hash, full_name, phone, role)
        values (${data.email}, ${passwordHash}, ${data.fullName}, ${data.phone || null}, 'customer')
        on conflict (email) do nothing
        returning id, email, full_name, role
      `) as { id: string; email: string; full_name: string | null; role: string }[];

      const created = rows[0];
      if (!created) {
        return {
          ok: false,
          error: "Kjo adresë email është tashmë e regjistruar. Provoni të hyni në llogari.",
        };
      }
      await startSession(created.id);
      return {
        ok: true,
        data: { id: created.id, email: created.email, fullName: created.full_name, role: "customer" },
      };
    })
  );

/** Sign in. One generic error for both "no such email" and "wrong password". */
export const loginCustomer = createServerFn({ method: "POST" })
  .inputValidator((input: LoginInput): LoginInput => ({
    email: normalizeEmail(input?.email),
    password: typeof input?.password === "string" ? input.password : "",
  }))
  .handler(async ({ data }): Promise<Result<AuthSuccess>> =>
    guarded(async () => {
      const BAD = "Email ose fjalëkalim i pasaktë. Provoni përsëri.";
      if (data.email === "" || data.password === "") return { ok: false, error: BAD };

      const rows = (await sql()`
        select id, email, full_name, role, status, password_hash
        from profiles where email = ${data.email} limit 1
      `) as {
        id: string;
        email: string;
        full_name: string | null;
        role: string;
        status: string;
        password_hash: string;
      }[];

      const profile = rows[0];
      // Always run a full scrypt derivation so a missing account and a wrong password
      // take the same time (no account enumeration through timing).
      const passwordOk = await verifyPassword(data.password, profile?.password_hash ?? DUMMY_HASH);
      if (!profile || !passwordOk) return { ok: false, error: BAD };
      if (profile.status !== "active") {
        return { ok: false, error: "Kjo llogari është e bllokuar. Kontaktoni dyqanin." };
      }

      await startSession(profile.id);
      return {
        ok: true,
        data: {
          id: profile.id,
          email: profile.email,
          fullName: profile.full_name,
          role: profile.role === "admin" ? "admin" : "customer",
        },
      };
    })
  );

/* ----------------------------------------------------------------- profile --- */

export type MyProfile = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: Role;
  createdAt: string;
  /** Always null in this shop: we have no way to verify an address, so we never claim to. */
  emailVerifiedAt: null;
};

export const getMyProfile = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<MyProfile>> =>
    guarded(async () => {
      const user = await requireUser();
      return {
        ok: true,
        data: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          role: user.role,
          createdAt: user.createdAt,
          emailVerifiedAt: null,
        },
      };
    })
);

/** Update the caller's own name/phone. The id comes from the session, never from input. */
export const updateMyProfile = createServerFn({ method: "POST" })
  .inputValidator((input: { fullName: string; phone?: string }) => ({
    fullName: str(input?.fullName),
    phone: str(input?.phone),
  }))
  .handler(async ({ data }): Promise<Result<{ fullName: string; phone: string | null }>> =>
    guarded(async () => {
      const user = await requireUser();
      const nameError = validateName(data.fullName);
      if (nameError) return { ok: false, error: nameError };
      const phoneError = validatePhone(data.phone);
      if (phoneError) return { ok: false, error: phoneError };

      await sql()`
        update profiles set full_name = ${data.fullName}, phone = ${data.phone || null}
        where id = ${user.id}
      `;
      return { ok: true, data: { fullName: data.fullName, phone: data.phone || null } };
    })
  );

/**
 * Change password while signed in — the real, working recovery path in a shop with no
 * email. Verifies the current password, stores a new scrypt hash, revokes every OTHER
 * session so a stolen session cannot outlive the change, and keeps this one signed in.
 */
export const changeMyPassword = createServerFn({ method: "POST" })
  .inputValidator((input: { currentPassword: string; newPassword: string }) => ({
    currentPassword: typeof input?.currentPassword === "string" ? input.currentPassword : "",
    newPassword: typeof input?.newPassword === "string" ? input.newPassword : "",
  }))
  .handler(async ({ data }): Promise<Result> =>
    guarded(async () => {
      const user = await requireUser();
      if (data.currentPassword === "") return { ok: false, error: "Shkruani fjalëkalimin aktual." };
      const passwordError = validatePassword(data.newPassword);
      if (passwordError) return { ok: false, error: passwordError };
      if (data.currentPassword === data.newPassword) {
        return { ok: false, error: "Fjalëkalimi i re duhet të ndryshojë nga ai aktual." };
      }

      const rows = (await sql()`
        select password_hash from profiles where id = ${user.id} limit 1
      `) as { password_hash: string }[];
      if (!rows[0] || !await verifyPassword(data.currentPassword, rows[0].password_hash)) {
        return { ok: false, error: "Fjalëkalimi aktual nuk është i saktë." };
      }

      const passwordHash = await hashPassword(data.newPassword);
      await sql()`update profiles set password_hash = ${passwordHash} where id = ${user.id}`;
      await sql()`
        delete from sessions
        where profile_id = ${user.id}
          and id <> (select s.id from sessions s
                     where s.profile_id = ${user.id} and s.expires_at > now()
                     order by s.created_at desc limit 1)
      `;
      return { ok: true, data: undefined };
    })
  );

/* --------------------------------------------------------------- addresses --- */

export type Address = {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  postalCode: string | null;
  country: string;
  isDefault: boolean;
};

export type AddressInput = {
  id?: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
};

type AddressRow = {
  id: string;
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  postal_code: string | null;
  country: string;
  is_default: boolean;
};

const mapAddress = (r: AddressRow): Address => ({
  id: r.id,
  fullName: r.full_name,
  phone: r.phone,
  line1: r.line1,
  line2: r.line2,
  city: r.city,
  postalCode: r.postal_code,
  country: r.country,
  isDefault: r.is_default,
});

function validateAddress(input: AddressInput): string | null {
  if (input.fullName.length < 2) return "Shkruani emrin e marrësit.";
  if (validatePhone(input.phone, true)) return validatePhone(input.phone, true);
  if (input.line1.length < 4) return "Shkruani adresën e dërgesës.";
  if (input.city.length < 2) return "Shkruani qytetin.";
  return null;
}

/** List ONLY the caller's addresses. */
export const listMyAddresses = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<Address[]>> =>
    guarded(async () => {
      const user = await requireUser();
      const rows = (await sql()`
        select id, full_name, phone, line1, line2, city, postal_code, country, is_default
        from addresses
        where profile_id = ${user.id}
        order by is_default desc, created_at desc
      `) as AddressRow[];
      return { ok: true, data: rows.map(mapAddress) };
    })
);

/** Create or update one of the caller's own addresses (id is verified against the session). */
export const saveMyAddress = createServerFn({ method: "POST" })
  .inputValidator((input: AddressInput): AddressInput => ({
    id: input?.id ? str(input.id) : undefined,
    fullName: str(input?.fullName),
    phone: str(input?.phone),
    line1: str(input?.line1),
    line2: str(input?.line2),
    city: str(input?.city),
    postalCode: str(input?.postalCode),
    country: str(input?.country) || "AL",
    isDefault: Boolean(input?.isDefault),
  }))
  .handler(async ({ data }): Promise<Result<Address>> =>
    guarded(async () => {
      const user = await requireUser();
      const invalid = validateAddress(data);
      if (invalid) return { ok: false, error: invalid };

      const existing = (await sql()`
        select count(*)::int as n from addresses where profile_id = ${user.id}
      `) as { n: number }[];
      const isFirst = Number(existing[0]?.n ?? 0) === 0;
      const makeDefault = Boolean(data.isDefault) || isFirst;

      if (makeDefault) {
        await sql()`update addresses set is_default = false where profile_id = ${user.id} and is_default`;
      }

      if (data.id) {
        const updated = (await sql()`
          update addresses
             set full_name = ${data.fullName}, phone = ${data.phone}, line1 = ${data.line1},
                 line2 = ${data.line2 || null}, city = ${data.city},
                 postal_code = ${data.postalCode || null}, country = ${data.country},
                 is_default = ${makeDefault}
           where id = ${data.id} and profile_id = ${user.id}
           returning id, full_name, phone, line1, line2, city, postal_code, country, is_default
        `) as AddressRow[];
        if (!updated[0]) return { ok: false, error: "Adresa nuk u gjet në llogarinë tuaj." };
        return { ok: true, data: mapAddress(updated[0]) };
      }

      const inserted = (await sql()`
        insert into addresses
          (profile_id, full_name, phone, line1, line2, city, postal_code, country, is_default)
        values (${user.id}, ${data.fullName}, ${data.phone}, ${data.line1}, ${data.line2 || null},
                ${data.city}, ${data.postalCode || null}, ${data.country}, ${makeDefault})
        returning id, full_name, phone, line1, line2, city, postal_code, country, is_default
      `) as AddressRow[];
      return { ok: true, data: mapAddress(inserted[0]) };
    })
  );

/** Delete one of the caller's own addresses; promotes the newest remaining one to default. */
export const deleteMyAddress = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => ({ id: str(input?.id) }))
  .handler(async ({ data }): Promise<Result> =>
    guarded(async () => {
      const user = await requireUser();
      if (!data.id) return { ok: false, error: "Adresa nuk u gjet në llogarinë tuaj." };
      const deleted = (await sql()`
        delete from addresses where id = ${data.id} and profile_id = ${user.id}
        returning id, is_default
      `) as { id: string; is_default: boolean }[];
      if (!deleted[0]) return { ok: false, error: "Adresa nuk u gjet në llogarinë tuaj." };
      if (deleted[0].is_default) {
        await sql()`
          update addresses set is_default = true
          where id = (select id from addresses where profile_id = ${user.id}
                      order by created_at desc limit 1)
            and profile_id = ${user.id}
        `;
      }
      return { ok: true, data: undefined };
    })
  );

/** Make one of the caller's own addresses the default. */
export const setDefaultAddress = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => ({ id: str(input?.id) }))
  .handler(async ({ data }): Promise<Result> =>
    guarded(async () => {
      const user = await requireUser();
      const owned = (await sql()`
        select id from addresses where id = ${data.id} and profile_id = ${user.id} limit 1
      `) as { id: string }[];
      if (!owned[0]) return { ok: false, error: "Adresa nuk u gjet në llogarinë tuaj." };
      await sql()`update addresses set is_default = false where profile_id = ${user.id} and is_default`;
      await sql()`
        update addresses set is_default = true where id = ${data.id} and profile_id = ${user.id}
      `;
      return { ok: true, data: undefined };
    })
  );

/* ------------------------------------------------------------------ orders --- */

export type MyOrder = {
  id: string;
  orderNumber: string;
  /** Unguessable token for this order's confirmation page (/porosia/<token>). */
  viewToken: string | null;
  status: string;
  statusLabel: string;
  total: string;
  createdAt: string;
  itemCount: number;
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Në pritje",
  confirmed: "Konfirmuar",
  processing: "Në përgatitje",
  shipped: "Dërguar",
  delivered: "Dorëzuar",
  cancelled: "Anuluar",
};

/** The caller's own orders only. Empty until checkout ships in step 3 — no sample orders. */
export const listMyOrders = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<MyOrder[]>> =>
    guarded(async () => {
      const user = await requireUser();
      const rows = (await sql()`
        select o.id, o.order_number, o.view_token, o.status, o.total, o.created_at,
               (select count(*)::int from order_items i where i.order_id = o.id) as item_count
        from orders o
        where o.profile_id = ${user.id}
        order by o.created_at desc
        limit 100
      `) as {
        id: string;
        order_number: string;
        view_token: string | null;
        status: string;
        total: string;
        created_at: string;
        item_count: number;
      }[];
      return {
        ok: true,
        data: rows.map((r) => ({
          id: r.id,
          orderNumber: r.order_number,
          viewToken: r.view_token ?? null,
          status: r.status,
          statusLabel: ORDER_STATUS_LABEL[r.status] ?? r.status,
          total: String(r.total),
          createdAt: String(r.created_at),
          itemCount: Number(r.item_count ?? 0),
        })),
      };
    })
);

/* ------------------------------------------------------------- admin setup --- */

export type AdminSetupState = {
  dbReady: boolean;
  admins: number;
  /** True when ADMIN_SETUP_TOKEN is configured on the server (a code exists to give out). */
  envTokenConfigured: boolean;
  /** How many unused, unexpired one-time codes are in the database right now. */
  liveCodes: number;
  setupOpen: boolean;
};

/** Read-only status for /admin/setup. Exposes counts only — never a token. */
export const getAdminSetupState = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminSetupState> => {
    const envTokenConfigured = Boolean((process.env.ADMIN_SETUP_TOKEN ?? "").trim());
    if (!process.env.DATABASE_URL) {
      return { dbReady: false, admins: 0, envTokenConfigured, liveCodes: 0, setupOpen: false };
    }
    try {
      const admins = await adminCount();
      const rows = (await sql()`
        select count(*)::int as n from admin_setup_codes
        where used_at is null and expires_at > now()
      `) as { n: number }[];
      return {
        dbReady: true,
        admins,
        envTokenConfigured,
        liveCodes: Number(rows[0]?.n ?? 0),
        setupOpen: admins === 0,
      };
    } catch (error) {
      console.error("[admin-setup] state:", error instanceof Error ? error.message : error);
      return { dbReady: false, admins: 0, envTokenConfigured, liveCodes: 0, setupOpen: false };
    }
  }
);

export type AdminSetupInput = {
  code: string;
  email: string;
  password: string;
  fullName: string;
};

/**
 * One-time first-administrator creation. Works ONLY while `profiles` has zero admins.
 * Accepts either the ADMIN_SETUP_TOKEN environment value or a live one-time code from
 * `bun run admin:code` (stored hashed in `admin_setup_codes`). The INSERT itself carries
 * `where not exists (select 1 from profiles where role = 'admin')`, so two concurrent
 * requests cannot both create an admin.
 */
export const submitAdminSetup = createServerFn({ method: "POST" })
  .inputValidator((input: AdminSetupInput): AdminSetupInput => ({
    code: str(input?.code),
    email: normalizeEmail(input?.email),
    password: typeof input?.password === "string" ? input.password : "",
    fullName: str(input?.fullName),
  }))
  .handler(async ({ data }): Promise<Result<AuthSuccess>> =>
    guarded(async () => {
      if (!process.env.DATABASE_URL) {
        return { ok: false, error: "Baza e të dhënave nuk është e lidhur ende." };
      }
      if ((await adminCount()) > 0) {
        return {
          ok: false,
          error:
            "Konfigurimi i administratorit është i mbyllur: ekziston tashmë një llogari administratori.",
        };
      }

      const emailError = validateEmail(data.email);
      if (emailError) return { ok: false, error: emailError };
      const passwordError = validatePassword(data.password);
      if (passwordError) return { ok: false, error: passwordError };
      const nameError = validateName(data.fullName);
      if (nameError) return { ok: false, error: nameError };

      const envOk = await envSetupTokenMatches(data.code);
      const codeRows =
        !envOk && data.code
          ? ((await sql()`
              select id from admin_setup_codes
              where token_hash = ${await hashToken(data.code)}
                and used_at is null and expires_at > now()
              limit 1
            `) as { id: string }[])
          : [];
      if (!envOk && codeRows.length === 0) {
        return { ok: false, error: "Kodi i sigurisë nuk është i saktë ose ka skaduar." };
      }

      const passwordHash = await hashPassword(data.password);
      const created = (await sql()`
        insert into profiles (email, password_hash, full_name, role)
        select ${data.email}, ${passwordHash}, ${data.fullName}, 'admin'
        where not exists (select 1 from profiles where role = 'admin')
        returning id, email, full_name
      `) as { id: string; email: string; full_name: string | null }[];

      if (!created[0]) {
        return {
          ok: false,
          error: "Konfigurimi i administratorit është i mbyllur: ekziston tashmë një administrator.",
        };
      }
      if (codeRows[0]) {
        await sql()`update admin_setup_codes set used_at = now() where id = ${codeRows[0].id}`;
      }
      // Any other outstanding codes are void once an admin exists.
      await sql()`update admin_setup_codes set used_at = now() where used_at is null`;

      await startSession(created[0].id);
      return {
        ok: true,
        data: {
          id: created[0].id,
          email: created[0].email,
          fullName: created[0].full_name,
          role: "admin",
        },
      };
    })
  );

/* ----------------------------------------------------------- password reset --- */

/**
 * Complete a password reset with a one-time token. The shop has NO email capability, so
 * the security code is issued by the shop itself (`bun run reset:code <email>`) and handed
 * over in person or by phone — no page ever says "check your inbox".
 */
export const completePasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; newPassword: string }) => ({
    token: str(input?.token),
    newPassword: typeof input?.newPassword === "string" ? input.newPassword : "",
  }))
  .handler(async ({ data }): Promise<Result> =>
    guarded(async () => {
      const BAD = "Kodi i rivendosjes nuk është i saktë ose ka skaduar. Kërkoni një kod të re nga dyqani.";
      if (!data.token) return { ok: false, error: BAD };
      const passwordError = validatePassword(data.newPassword);
      if (passwordError) return { ok: false, error: passwordError };

      const rows = (await sql()`
        select t.id, t.profile_id
        from password_reset_tokens t
        where t.token_hash = ${await hashToken(data.token)}
          and t.used_at is null and t.expires_at > now()
        limit 1
      `) as { id: string; profile_id: string }[];
      const tokenRow = rows[0];
      if (!tokenRow) return { ok: false, error: BAD };

      const passwordHash = await hashPassword(data.newPassword);
      await sql()`update profiles set password_hash = ${passwordHash} where id = ${tokenRow.profile_id}`;
      await sql()`update password_reset_tokens set used_at = now() where id = ${tokenRow.id}`;
      // Every existing session for that account dies with the password change.
      await sql()`delete from sessions where profile_id = ${tokenRow.profile_id}`;
      return { ok: true, data: undefined };
    })
);

/**
 * What the /rivendos-fjalekalimin page can honestly say about the caller's state.
 * Nothing about any account is disclosed — this is about the *page*, not a user.
 */
export const getResetPageState = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ dbReady: boolean; signedInEmail: string | null }> => {
    if (!process.env.DATABASE_URL) return { dbReady: false, signedInEmail: null };
    try {
      const user = await getCurrentUser();
      return { dbReady: true, signedInEmail: user?.email ?? null };
    } catch {
      return { dbReady: false, signedInEmail: null };
    }
  }
);

/* ------------------------------------------------------------------ helpers --- */

/** Sign out (used by the header). Kept here so callers import from one place. */
export { logoutCustomer } from "~/server/auth";

