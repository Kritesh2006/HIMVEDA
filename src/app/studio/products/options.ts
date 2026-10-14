import "server-only";
import { asc, desc } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { listMedia } from "@/server/ops/admin";
import { loadRates } from "@/server/currency/service";

export async function editorOptions() {
  const [categories, farmers, centers, batches, media, rates] = await Promise.all([
    db.select({ id: schema.categories.id, label: schema.categories.name }).from(schema.categories).orderBy(asc(schema.categories.sortOrder)),
    db.select({ id: schema.farmers.id, code: schema.farmers.code, name: schema.farmers.fullName }).from(schema.farmers).orderBy(asc(schema.farmers.code)),
    db.select({ id: schema.collectionCenters.id, code: schema.collectionCenters.code, name: schema.collectionCenters.name }).from(schema.collectionCenters).orderBy(asc(schema.collectionCenters.code)),
    db.select({ id: schema.batches.id, code: schema.batches.code, commodity: schema.batches.commodity }).from(schema.batches).orderBy(desc(schema.batches.createdAt)),
    listMedia(),
    loadRates(),
  ]);
  return {
    categories,
    farmers: farmers.map((f) => ({ id: f.id, label: `${f.code} · ${f.name}` })),
    centers: centers.map((c) => ({ id: c.id, label: `${c.code} · ${c.name}` })),
    batches: batches.map((b) => ({ id: b.id, label: `${b.code} · ${b.commodity}` })),
    media: media.map((m) => ({ id: m.id, alt: m.alt, mimeType: m.mimeType })),
    rates: Object.fromEntries(Object.entries(rates.rates).filter(([, v]) => typeof v === "number")) as Record<string, number>,
  };
}
