/**
 * Minimal SQL migration runner for HandmadeAVA.
 *
 *   bun run db:migrate
 *
 * Applies every `db/migrations/*.sql` file in name order, once, recording each in
 * `schema_migrations`. Statements are split on top-level semicolons (dollar-quoted
 * bodies and comments are respected) and each is sent as its own simple query, so a
 * failure points at the offending statement.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Connect Neon Postgres and set DATABASE_URL, then re-run.");
  process.exit(1);
}
const sql = neon(url);

function splitStatements(source: string): string[] {
  const out: string[] = [];
  let current = "";
  let i = 0;
  let dollar: string | null = null;
  let lineComment = false;
  let blockComment = false;
  while (i < source.length) {
    const two = source.slice(i, i + 2);
    if (lineComment) {
      current += source[i];
      if (source[i] === "\n") lineComment = false;
      i += 1;
      continue;
    }
    if (blockComment) {
      current += source[i];
      if (two === "*/") {
        current += "/";
        blockComment = false;
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    if (dollar) {
      if (source.startsWith(dollar, i)) {
        current += dollar;
        i += dollar.length;
        dollar = null;
        continue;
      }
      current += source[i];
      i += 1;
      continue;
    }
    if (two === "--") {
      lineComment = true;
      current += two;
      i += 2;
      continue;
    }
    if (two === "/*") {
      blockComment = true;
      current += two;
      i += 2;
      continue;
    }
    if (source[i] === "$") {
      const match = /^\$[a-zA-Z_]*\$/.exec(source.slice(i));
      if (match) {
        dollar = match[0];
        current += dollar;
        i += dollar.length;
        continue;
      }
    }
    if (source[i] === ";") {
      if (current.trim()) out.push(current.trim());
      current = "";
      i += 1;
      continue;
    }
    current += source[i];
    i += 1;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

const dir = join(import.meta.dir, "..", "db", "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

await sql`create table if not exists schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
)`;

for (const file of files) {
  const done = (await sql`select 1 from schema_migrations where name = ${file}`) as unknown[];
  if (done.length > 0) {
    console.log(`skip  ${file} (already applied)`);
    continue;
  }
  const source = readFileSync(join(dir, file), "utf8");
  const statements = splitStatements(source);
  console.log(`apply ${file} (${statements.length} statements)`);
  for (const statement of statements) {
    await sql.query(statement);
  }
  await sql`insert into schema_migrations (name) values (${file})`;
}
console.log("migrations complete");
