/**
 * Removes every record flagged `is_demo`. Shared by Studio (Settings → Remove
 * demonstration data) and the seed script. Order respects foreign keys.
 */
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../db/schema";

// Fixed allow-list, in dependency order — never built from user input.
const TABLES = [
  "orders",
  "inventory_movements",
  "farmer_payments",
  "procurements",
  "quality_tests",
  "processing_runs",
  "traceability_events",
  "batches",
  "inspections",
  "collection_receipts",
  "products",
  "price_approvals",
  "pricing_rules",
  "farms",
  "farmers",
  "inventory_locations",
  "collection_centers",
  "media",
] as const;

export async function purgeDemoData(db: NodePgDatabase<typeof schema>): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  await db.transaction(async (tx) => {
    for (const t of TABLES) {
      const res = await tx.execute(sql.raw(`DELETE FROM "${t}" WHERE is_demo = true`));
      counts[t] = res.rowCount ?? 0;
    }
  });
  return counts;
}
