/** Development only: drops every table in the public schema. */
import { pool } from "./db";

if (process.env.NODE_ENV === "production" || /prod/i.test(process.env.DATABASE_URL ?? "")) {
  console.error("Refusing to reset what looks like a production database.");
  process.exit(1);
}
await pool.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
console.log("✓ database reset");
await pool.end();
