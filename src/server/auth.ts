/**
 * Authentication + authorisation core for HandmadeAVA.
 *
 * ─── MODEL ──────────────────────────────────────────────────────────────────────────
 * Sessions are opaque random 32-byte tokens held in an HttpOnly cookie. The database
 * stores only `sha256(token)`, so a leaked table dump cannot be replayed as a login.
 * A session is valid while `expires_at > now()`; the lifetime is 14 days and SLIDES —
 * on each authenticated request that has less than 7 days left, the row (and the cookie)
 * is extended back to 14 days. Logout deletes the row and clears the cookie, so the same
 * token can never be used again.
 *
 * Roles live on `profiles.role` ('customer' | 'admin') and are only ever read from the
 * database via the session's profile id. No client input can set or influence a role.
 *
 * ─── AUTHORIZATION RULE ────────────────────────────────────────────────────────────
 * Every protected server function / route loader must go through `requireUser()` or
 * `requireAdmin()` and scope its queries with the returned `user.id` — never with an id
 * taken from request input. See `src/server/accounts.ts` for the pattern.
 *
 * Cookie helpers are imported dynamically inside handlers only, so this module can be
 * imported by client components for its `createServerFn` exports without pulling
 * server-only runtime code into the browser bundle.
 */
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { hashToken, randomToken, safeEqual } from "~/server/password";

export const SESSION_COOKIE = "ava_session";
/** Session lifetime in days (fixed length, refreshed by use — see note above). */
export const SESSION_TTL_DAYS = 14;
/** Refresh the session when fewer than this many days remain. */
export const SESSION_REFRESH_DAYS = 7;

export type Role = "customer" | "admin";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: Role;
  createdAt: string;
};

export type AuthErrorCode = "unauthenticated" | "forbidden" | "db_unavailable";

/** Thrown by the require* helpers; server functions translate it into an Albanian result. */
export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export const AUTH_MESSAGES: Record<AuthErrorCode, string> = {
  unauthenticated: "Duhet të hyni në llogari për të vazhduar.",
  forbidden: "Nuk keni leje për të kryer këtë veprim.",
  db_unavailable: "Llogaritë nuk janë të disponueshme në këtë moment. Provoni së shpejti.",
};

/* --------------------------------------------------------------- primitives --- */

const server = () => import("@tanstack/react-start/server");

/**
 * Cookie flags. `HttpOnly` (no JS access) + `SameSite=Lax` (not sent on cross-site POSTs,
 * so a foreign page cannot drive the account endpoints) + `Secure` whenever the request
 * itself arrived over https (the published site always does, via the proxy's
 * `x-forwarded-proto`) or when NODE_ENV is production. Leaving Secure off for plain-http
 * localhost requests is what lets the same flow be exercised on http://localhost:3000.
 */
async function cookieOptions(maxAgeSeconds: number) {
  let secure = process.env.NODE_ENV === "production";
  try {
    const { getRequest } = await server();
    const request = getRequest();
    const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (forwarded === "https" || new URL(request.url).protocol === "https:") secure = true;
  } catch {
    // No request context (should not happen inside a handler) — keep the env default.
  }
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/** Create a session row for a profile, set the cookie, and return the raw token. */
export async function startSession(profileId: string): Promise<string> {
  const token = await randomToken(32);
  await sql()`
    insert into sessions (profile_id, token_hash, expires_at)
    values (${profileId}, ${await hashToken(token)}, now() + (${SESSION_TTL_DAYS} || ' days')::interval)
  `;
  const { setCookie } = await server();
  setCookie(SESSION_COOKIE, token, await cookieOptions(SESSION_TTL_DAYS * 24 * 60 * 60));
  return token;
}

/** Delete the current session row (if any) and clear the cookie. */
export async function endSession(): Promise<void> {
  const { getCookie, deleteCookie } = await server();
  const token = getCookie(SESSION_COOKIE);
  if (token) {
    await sql()`delete from sessions where token_hash = ${await hashToken(token)}`;
  }
  deleteCookie(SESSION_COOKIE, { path: "/" });
}

type SessionRow = {
  session_id: string;
  profile_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  status: string;
  created_at: string;
  days_left: number;
};

/**
 * Resolve the signed-in user from the session cookie.
 * Returns null when there is no cookie, the row is gone, the session expired, or the
 * profile has been blocked. Slides the expiry forward when it is running out.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const { getCookie, setCookie } = await server();
  const token = getCookie(SESSION_COOKIE);
  if (!token) return null;

  const rows = (await sql()`
    select s.id as session_id, p.id as profile_id, p.email, p.full_name, p.phone,
           p.role, p.status, p.created_at,
           extract(day from (s.expires_at - now()))::int as days_left
    from sessions s
    join profiles p on p.id = s.profile_id
    where s.token_hash = ${await hashToken(token)}
      and s.expires_at > now()
    limit 1
  `) as SessionRow[];
  const row = rows[0];
  if (!row || row.status !== "active") return null;

  if (row.days_left < SESSION_REFRESH_DAYS) {
    try {
      await sql()`
        update sessions
           set expires_at = now() + (${SESSION_TTL_DAYS} || ' days')::interval
         where id = ${row.session_id}
      `;
      setCookie(SESSION_COOKIE, token, await cookieOptions(SESSION_TTL_DAYS * 24 * 60 * 60));
    } catch (error) {
      console.error("[auth] session refresh failed:", error instanceof Error ? error.message : error);
    }
  }

  return {
    id: row.profile_id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role === "admin" ? "admin" : "customer",
    createdAt: String(row.created_at),
  };
}

/** Require a signed-in, active profile. Throws AuthError('unauthenticated') otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("unauthenticated", AUTH_MESSAGES.unauthenticated);
  return user;
}

/** Require a signed-in ADMIN. Throws AuthError('forbidden') for customers. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new AuthError("forbidden", AUTH_MESSAGES.forbidden);
  return user;
}

/** True when the database refuses to answer (no DATABASE_URL, or the query failed). */
export function isDbUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /DATABASE_URL is not set|fetch failed|ENOTFOUND|connect|terminat|relation .* does not exist/i.test(
    message
  );
}

/**
 * Count admin profiles. Used by the one-time setup page: it stays open only while this is 0.
 */
export async function adminCount(): Promise<number> {
  const rows = (await sql()`select count(*)::int as n from profiles where role = 'admin'`) as {
    n: number;
  }[];
  return Number(rows[0]?.n ?? 0);
}

/** Constant-time check of a candidate against `ADMIN_SETUP_TOKEN`, if that env var is set. */
export async function envSetupTokenMatches(candidate: string): Promise<boolean> {
  const expected = process.env.ADMIN_SETUP_TOKEN;
  if (!expected || expected.trim() === "") return false;
  return await safeEqual(candidate.trim(), expected.trim());
}

/** Resolve the effective role of the caller, for loaders that must show one of two pages. */
export async function getCurrentRole(): Promise<Role | null> {
  const user = await getCurrentUser();
  return user ? user.role : null;
}

/* ------------------------------------------------------------- server funcs --- */

export type SessionState = { user: SessionUser | null; dbReady: boolean };

/**
 * Public endpoint the client uses to draw the header and to gate protected pages.
 * It is safe to call from anywhere: it returns only the caller's own profile, or null.
 */
export const getSessionState = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionState> => {
    if (!process.env.DATABASE_URL) return { user: null, dbReady: false };
    try {
      return { user: await getCurrentUser(), dbReady: true };
    } catch (error) {
      // A broken session lookup must never 500 a public page: treat it as "signed out".
      console.error("[auth] session lookup failed:", error instanceof Error ? error.message : error);
      return { user: null, dbReady: false };
    }
  }
);

/** Log out: delete the session row and clear the cookie. Always succeeds. */
export const logoutCustomer = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true }> => {
    try {
      await endSession();
    } catch (error) {
      // Even if the row cannot be deleted (no DB), the cookie must still be cleared so the
      // browser stops presenting it.
      console.error("[auth] logout:", error instanceof Error ? error.message : error);
      const { deleteCookie } = await server();
      deleteCookie(SESSION_COOKIE, { path: "/" });
    }
    return { ok: true };
  }
);
