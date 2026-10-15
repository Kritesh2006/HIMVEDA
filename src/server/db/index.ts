import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import net from "node:net";
import { Pool } from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

declare global {
  var __himvedaPool: Pool | undefined;
}

// Node's happy-eyeballs gives each address family only 250 ms by default. Cross-region
// links to managed Postgres can exceed that, surfacing as AggregateError ETIMEDOUT.
if (typeof net.setDefaultAutoSelectFamilyAttemptTimeout === "function") {
  net.setDefaultAutoSelectFamilyAttemptTimeout(2_000);
}

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return new Pool({
    connectionString: url,
    max: process.env.NODE_ENV === "production" ? 5 : 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 20_000,
    keepAlive: true,
    ssl: /sslmode=require|neon\.tech|supabase\.co/.test(url) ? { rejectUnauthorized: false } : undefined,
  });
}

// Reuse the pool across hot reloads / warm serverless invocations.
const pool = globalThis.__himvedaPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalThis.__himvedaPool = pool;

export const db: DB = drizzle(pool, { schema });
export { schema };
