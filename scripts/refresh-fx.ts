/** Refresh exchange rates from FX_PROVIDER (falls back to documented dev rates). */
import { db, pool, schema } from "./db";
import { DEV_NPR_PER_UNIT } from "../src/server/currency/dev-rates";

const provider = process.env.FX_PROVIDER;
const key = process.env.FX_API_KEY;
let rates: Record<string, number> = {};
let source = "dev-static";
if (provider === "exchangerate-api" && key) {
  const res = await fetch(`https://v6.exchangerate-api.com/v6/${key}/latest/NPR`);
  const body = (await res.json()) as { conversion_rates?: Record<string, number> };
  if (body.conversion_rates) {
    rates = body.conversion_rates;
    source = "exchangerate-api";
  }
}
if (source === "dev-static") rates = Object.fromEntries(Object.entries(DEV_NPR_PER_UNIT).map(([c, v]) => [c, 1 / v]));
for (const currency of Object.keys(DEV_NPR_PER_UNIT)) {
  const r = rates[currency];
  if (!r) continue;
  await db
    .insert(schema.currencyRates)
    .values({ currency, ratePerNpr: r.toFixed(10), source })
    .onConflictDoUpdate({ target: schema.currencyRates.currency, set: { ratePerNpr: r.toFixed(10), source, fetchedAt: new Date() } });
}
console.log(`✓ rates refreshed from ${source}`);
await pool.end();
