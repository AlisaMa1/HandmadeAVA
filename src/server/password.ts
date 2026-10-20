/**
 * Password and token cryptography for HandmadeAVA — `node:crypto` only, no dependency.
 *
 * Passwords are hashed with scrypt and a fresh 16-byte random salt per user. The stored
 * string is self-describing and versioned, so the work factor can be raised later without
 * guessing what an old hash used:
 *
 *   scrypt$1$32768$8$1$<salt hex>$<derived key hex>
 *   ^algo  ^v ^N     ^r ^p ^salt        ^key (64 bytes)
 *
 * Verification re-derives with the parameters from the stored string and compares with
 * `timingSafeEqual`. Nothing here ever stores or returns a plaintext password.
 *
 * This module is deliberately free of app/runtime imports so plain `bun run` scripts
 * (scripts/admin-code.ts, scripts/reset-code.ts) can import it directly.
 */
/**
 * `node:crypto` is loaded lazily, inside the functions that need it. The account routes
 * import this module, so a static `node:crypto` import would drag it into the browser
 * bundle (Node built-ins do not exist there). Loaded this way the module is evaluated only
 * on the server, where every one of these functions actually runs.
 */
const nodeCrypto = () => import("node:crypto");

const VERSION = "1";
const N = 32768; // CPU/memory cost — 2^15
const R = 8; // block size
const P = 1; // parallelisation
const KEYLEN = 64;
const SALT_BYTES = 16;
const MAXMEM = 96 * 1024 * 1024; // scrypt needs ~128*N*r bytes; give it headroom

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

/** Hash a plaintext password into the versioned `scrypt$…` string stored in `profiles`. */
export async function hashPassword(password: string): Promise<string> {
  const { randomBytes, scryptSync } = await nodeCrypto();
  const salt = randomBytes(SALT_BYTES);
  const key = scryptSync(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return ["scrypt", VERSION, N, R, P, salt.toString("hex"), key.toString("hex")].join("$");
}

/**
 * Compare a plaintext password against a stored hash. Returns false for anything that is
 * not a well-formed hash of ours (including the empty string), and never throws on a
 * malformed stored value — a broken row must not log anyone in, but it must not 500 either.
 */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined
): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 7 || parts[0] !== "scrypt") return false;
  const [, version, nRaw, rRaw, pRaw, saltHex, keyHex] = parts;
  if (version !== VERSION) return false;
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (n < 1024 || n > 1_048_576 || r < 1 || r > 32 || p < 1 || p > 16) return false;
  try {
    const { scryptSync, timingSafeEqual } = await nodeCrypto();
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(keyHex, "hex");
    if (salt.length === 0 || expected.length === 0) return false;
    const actual = scryptSync(password.normalize("NFKC"), salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: Math.max(MAXMEM, 256 * n * r),
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ tokens --- */

/** 32 random bytes, url-safe — used for session cookies and one-time codes. */
export async function randomToken(bytes = 32): Promise<string> {
  const { randomBytes } = await nodeCrypto();
  return randomBytes(bytes).toString("base64url");
}

/**
 * A human-typeable one-time code (admin setup, password reset when the owner reads it out
 * over the phone): 10 groups from an alphabet with no look-alikes (no 0/O, 1/I).
 */
export async function randomReadableCode(groups = 4, groupLength = 5): Promise<string> {
  const { randomBytes } = await nodeCrypto();
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const raw = randomBytes(groups * groupLength);
  const out: string[] = [];
  for (let g = 0; g < groups; g += 1) {
    let chunk = "";
    for (let i = 0; i < groupLength; i += 1) chunk += alphabet[raw[g * groupLength + i] % alphabet.length];
    out.push(chunk);
  }
  return out.join("-");
}

/** SHA-256 hex of a token/code — the only form ever written to the database. */
export async function hashToken(token: string): Promise<string> {
  const { createHash } = await nodeCrypto();
  return createHash("sha256").update(token.trim()).digest("hex");
}

/** Constant-time string comparison for secrets compared in memory (e.g. ADMIN_SETUP_TOKEN). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const { timingSafeEqual } = await nodeCrypto();
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
