/**
 * Issue a ONE-TIME code for the first-administrator setup page (/admin/setup).
 *
 *   bun run admin:code            # code valid for 30 minutes, printed once
 *   bun run admin:code -- --ttl 60  # valid for 60 minutes
 *
 * The code is printed to the terminal and never stored: only its SHA-256 hash goes into
 * `admin_setup_codes`, with an expiry. Hand the printed code to the owner (in person or by
 * phone). She opens /admin/setup, enters it with her own email and chosen password, and
 * that account is created with role 'admin'. As soon as one admin exists the page refuses.
 *
 * Alternative: set ADMIN_SETUP_TOKEN on the Secrets page and skip this script entirely —
 * /admin/setup accepts that value as the code.
 */
import { neon } from "@neondatabase/serverless";
import { hashToken, randomReadableCode } from "../src/server/password";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Connect the database, then re-run `bun run admin:code`.");
  process.exit(1);
}

const ttlIndex = process.argv.indexOf("--ttl");
const ttlMinutes = ttlIndex === -1 ? 30 : Number(process.argv[ttlIndex + 1]);
if (!Number.isFinite(ttlMinutes) || ttlMinutes < 5 || ttlMinutes > 1440) {
  console.error("--ttl must be between 5 and 1440 minutes.");
  process.exit(1);
}

const sql = neon(url);

const admins = (await sql`select count(*)::int as n from profiles where role = 'admin'`) as { n: number }[];
if (Number(admins[0]?.n ?? 0) > 0) {
  console.error(
    "An administrator already exists — /admin/setup is closed, so no code is needed.\n" +
      "Sign in as that administrator instead."
  );
  process.exit(1);
}

const code = await randomReadableCode();
await sql`
  insert into admin_setup_codes (token_hash, expires_at)
  values (${await hashToken(code)}, now() + (${ttlMinutes} || ' minutes')::interval)
`;

console.log("");
console.log("  One-time administrator setup code (valid " + ttlMinutes + " minutes):");
console.log("");
console.log("      " + code);
console.log("");
console.log("  Give it to the owner. She opens /admin/setup, enters this code together with");
console.log("  her own email, name and password. The code works once and only while the");
console.log("  database has no administrator account.");
console.log("");
