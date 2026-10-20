/**
 * Issue a ONE-TIME password-reset code for a customer, because this shop has NO email.
 *
 *   bun run reset:code -- owner@example.com          # code valid for 60 minutes
 *   bun run reset:code -- owner@example.com --ttl 15
 *
 * Only the SHA-256 hash of the code is stored (`password_reset_tokens`), with an expiry.
 * The customer enters the code on /rivendos-fjalekalimin with a new password. Single use:
 * the row is marked used, and every existing session for that account is revoked.
 *
 * Give the printed code to the customer in person or by phone. Nothing here sends email —
 * no page ever claims that one was sent.
 */
import { neon } from "@neondatabase/serverless";
import { hashToken, randomReadableCode } from "../src/server/password";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Connect the database, then re-run `bun run reset:code`.");
  process.exit(1);
}

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email || email.startsWith("--")) {
  console.error("Usage: bun run reset:code -- <email> [--ttl <minutes>]");
  process.exit(1);
}

const ttlIndex = process.argv.indexOf("--ttl");
const ttlMinutes = ttlIndex === -1 ? 60 : Number(process.argv[ttlIndex + 1]);
if (!Number.isFinite(ttlMinutes) || ttlMinutes < 5 || ttlMinutes > 1440) {
  console.error("--ttl must be between 5 and 1440 minutes.");
  process.exit(1);
}

const sql = neon(url);

const profiles = (await sql`
  select id, full_name from profiles where email = ${email} limit 1
`) as { id: string; full_name: string | null }[];

if (!profiles[0]) {
  // Deliberately unhelpful: this command is run by shop staff, but keep the habit.
  console.error("No account with that email address.");
  process.exit(1);
}

const code = await randomReadableCode();
// Supersede any earlier unused codes for this account.
await sql`update password_reset_tokens set used_at = now() where profile_id = ${profiles[0].id} and used_at is null`;
await sql`
  insert into password_reset_tokens (profile_id, token_hash, expires_at)
  values (${profiles[0].id}, ${await hashToken(code)}, now() + (${ttlMinutes} || ' minutes')::interval)
`;

console.log("");
console.log("  Password-reset code for " + email + " (valid " + ttlMinutes + " minutes):");
console.log("");
console.log("      " + code);
console.log("");
console.log("  Hand it to the customer. They open /rivendos-fjalekalimin, enter the code with");
console.log("  a new password. Single use; all their open sessions are signed out on use.");
console.log("");
