import "server-only";
import { cache } from "react";
import { count, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { getPublicTrace, listPublicBatchCodes, listPublicCenters } from "@/server/trace/queries";

/** The batch featured on the homepage: the configured code, else the most recently created public batch. */
export const getHeroTrace = cache(async (configured: string) => {
  if (configured) {
    const t = await getPublicTrace(configured);
    if (t) return t;
  }
  const [latest] = await db
    .select({ code: schema.batches.code })
    .from(schema.batches)
    .where(eq(schema.batches.isPublic, true))
    .orderBy(desc(schema.batches.harvestDate))
    .limit(1);
  return latest ? getPublicTrace(latest.code) : null;
});

/** A recent receipt rendered as a specimen on the producers section — public-safe fields only. */
export const getSpecimenReceipt = cache(async () => {
  const r = await db.query.collectionReceipts.findFirst({
    where: eq(schema.collectionReceipts.status, "procured"),
    orderBy: [desc(schema.collectionReceipts.receivedAt)],
    with: {
      collectionCenter: { columns: { name: true, code: true } },
      farmer: { columns: { code: true, district: true } },
      inspections: { columns: { visualGrade: true, moisturePct: true, foreignMatterPct: true, acceptedGrams: true, result: true } },
      procurement: { columns: { id: true }, with: { payments: { columns: { status: true } } } },
    },
  });
  if (!r) return null;
  const insp = r.inspections[0];
  return {
    receiptNo: r.receiptNo,
    center: r.collectionCenter.name,
    centerCode: r.collectionCenter.code,
    producer: `${r.farmer.code.slice(0, 4)}••${r.farmer.code.slice(-2)}`,
    district: r.farmer.district,
    commodity: r.commodity,
    receivedAt: r.receivedAt.toISOString(),
    grossKg: r.grossGrams / 1000,
    tareKg: r.tareGrams / 1000,
    netKg: r.netGrams / 1000,
    moisture: insp?.moisturePct ? Number(insp.moisturePct) : null,
    foreign: insp?.foreignMatterPct ? Number(insp.foreignMatterPct) : null,
    grade: insp?.visualGrade ?? null,
    acceptedKg: insp?.acceptedGrams ? insp.acceptedGrams / 1000 : null,
    result: insp?.result ?? null,
    paid: r.procurement?.payments.some((p) => p.status === "paid") ?? false,
    isDemo: r.isDemo,
  };
});

/** Live counts from the operating ledger (shown on the technology section). */
export const getLedgerCounts = cache(async () => {
  const first = async (q: PromiseLike<{ n: number }[]>) => (await q)[0]?.n ?? 0;
  const [receipts, inspections, procurements, batches, runs, orders, events, packs] = await Promise.all([
    first(db.select({ n: count() }).from(schema.collectionReceipts)),
    first(db.select({ n: count() }).from(schema.inspections)),
    first(db.select({ n: count() }).from(schema.procurements)),
    first(db.select({ n: count() }).from(schema.batches)),
    first(db.select({ n: count() }).from(schema.processingRuns)),
    first(db.select({ n: count() }).from(schema.orders)),
    first(db.select({ n: count() }).from(schema.traceabilityEvents)),
    db.select({ n: sql<number>`coalesce(sum(${schema.batches.unitsPacked}),0)::int` }).from(schema.batches).then((r) => r[0]!.n),
  ]);
  const [kgRow] = await db.select({ kg: sql<number>`coalesce(sum(${schema.collectionReceipts.netGrams}),0)::bigint / 1000` }).from(schema.collectionReceipts);
  return { receipts, inspections, procurements, batches, runs, orders, events, packs, netKg: Number(kgRow?.kg ?? 0) };
});

export { listPublicBatchCodes, listPublicCenters };
