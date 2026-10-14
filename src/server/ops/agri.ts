import "server-only";
import { and, asc, desc, eq, inArray, like, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { writeAudit, type Actor } from "@/server/audit";

export class OpsError extends Error {}

const kgToG = (kg: number) => Math.round(kg * 1000);
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

/* ───────────────────────── Producers ───────────────────────── */

export const farmerInput = z.object({
  fullName: z.string().trim().min(2, "Name is required").max(120),
  publicName: optional(120),
  publishConsent: z.coerce.boolean().default(false),
  phone: optional(40),
  district: z.string().trim().min(2, "District is required").max(60),
  municipality: optional(80),
  cooperative: optional(120),
  notes: optional(1000),
  farmName: optional(120),
  altitudeM: z.coerce.number().int().min(0).max(9000).optional().nullable(),
  approxLat: z.coerce.number().min(26).max(31).optional().nullable(),
  approxLng: z.coerce.number().min(80).max(89).optional().nullable(),
  crops: optional(200),
});

export async function listFarmers() {
  return db.query.farmers.findMany({
    orderBy: [asc(schema.farmers.code)],
    with: { farms: true, receipts: { columns: { netGrams: true } } },
  });
}

export async function saveFarmer(actor: Actor, raw: unknown, id?: string) {
  const f = farmerInput.parse(raw);
  return db.transaction(async (tx) => {
    let farmerId = id;
    const values = {
      fullName: f.fullName,
      publicName: f.publicName,
      publishConsent: f.publishConsent && Boolean(f.publicName),
      phone: f.phone,
      district: f.district,
      municipality: f.municipality,
      cooperative: f.cooperative,
      notes: f.notes,
    };
    if (farmerId) {
      await tx.update(schema.farmers).set(values).where(eq(schema.farmers.id, farmerId));
    } else {
      const [{ n }] = (await tx.select({ n: sql<number>`count(*)::int` }).from(schema.farmers)) as [{ n: number }];
      let code = `FMR-${String(n + 1).padStart(4, "0")}`;
      while (await tx.query.farmers.findFirst({ where: eq(schema.farmers.code, code), columns: { id: true } })) {
        code = `FMR-${String(Number(code.slice(4)) + 1).padStart(4, "0")}`;
      }
      const [row] = await tx.insert(schema.farmers).values({ ...values, code }).returning({ id: schema.farmers.id });
      farmerId = row!.id;
    }
    if (f.farmName) {
      const existing = await tx.query.farms.findFirst({ where: eq(schema.farms.farmerId, farmerId) });
      const farm = {
        name: f.farmName,
        district: f.district,
        altitudeM: f.altitudeM ?? null,
        approxLat: f.approxLat != null ? f.approxLat.toFixed(2) : null,
        approxLng: f.approxLng != null ? f.approxLng.toFixed(2) : null,
        crops: f.crops ? f.crops.split(",").map((c) => c.trim()).filter(Boolean) : [],
      };
      if (existing) await tx.update(schema.farms).set(farm).where(eq(schema.farms.id, existing.id));
      else await tx.insert(schema.farms).values({ ...farm, farmerId });
    }
    await writeAudit(
      actor,
      { action: id ? "farmer.update" : "farmer.create", entityType: "farmer", entityId: farmerId, summary: `${actor.label} ${id ? "updated" : "registered"} producer ${f.fullName}` },
      tx,
    );
    return farmerId!;
  });
}

/* ───────────────────────── Collection centres ───────────────────────── */

export const centerInput = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Code must be three letters"),
  name: z.string().trim().min(3).max(120),
  district: z.string().trim().min(2).max(60),
  province: optional(60),
  lat: z.coerce.number().min(26).max(31).optional().nullable(),
  lng: z.coerce.number().min(80).max(89).optional().nullable(),
  address: optional(300),
  isPublic: z.coerce.boolean().default(false),
});

export async function listCenters() {
  return db.query.collectionCenters.findMany({ orderBy: [asc(schema.collectionCenters.code)] });
}

export async function saveCenter(actor: Actor, raw: unknown, id?: string) {
  const c = centerInput.parse(raw);
  const values = { ...c, lat: c.lat != null ? c.lat.toFixed(4) : null, lng: c.lng != null ? c.lng.toFixed(4) : null };
  return db.transaction(async (tx) => {
    const clash = await tx.query.collectionCenters.findFirst({ where: eq(schema.collectionCenters.code, c.code), columns: { id: true } });
    if (clash && clash.id !== id) throw new OpsError(`Centre code ${c.code} is already used`);
    let centerId = id;
    if (id) await tx.update(schema.collectionCenters).set(values).where(eq(schema.collectionCenters.id, id));
    else {
      const [row] = await tx.insert(schema.collectionCenters).values(values).returning({ id: schema.collectionCenters.id });
      centerId = row!.id;
      await tx.insert(schema.inventoryLocations).values({ code: `CC-${c.code}`, name: c.name, kind: "collection_center", district: c.district, collectionCenterId: centerId });
    }
    await writeAudit(actor, { action: id ? "center.update" : "center.create", entityType: "center", entityId: centerId, summary: `${actor.label} ${id ? "updated" : "opened"} collection centre ${c.code} · ${c.name}` }, tx);
    return centerId!;
  });
}

/* ───────────────────────── Receipts → inspection → procurement ───────────────────────── */

export const receiptInput = z
  .object({
    farmerId: z.string().uuid("Choose a producer"),
    collectionCenterId: z.string().uuid("Choose a centre"),
    commodity: z.string().trim().min(2, "Commodity is required").max(80),
    harvestDate: z
      .string()
      .optional()
      .transform((v) => v || null),
    grossKg: z.coerce.number().positive("Gross weight must be positive").max(100_000),
    tareKg: z.coerce.number().min(0).max(10_000).default(0),
    moisturePct: z.coerce.number().min(0).max(100).optional().nullable(),
    receivedBy: optional(80),
    notes: optional(1000),
  })
  .refine((r) => r.tareKg < r.grossKg, { path: ["tareKg"], message: "Tare must be less than gross weight" });

export async function listReceipts(status?: string) {
  return db.query.collectionReceipts.findMany({
    where: status ? eq(schema.collectionReceipts.status, status as "received") : undefined,
    orderBy: [desc(schema.collectionReceipts.receivedAt)],
    limit: 200,
    with: {
      farmer: { columns: { code: true, fullName: true, isDemo: true } },
      collectionCenter: { columns: { code: true, name: true } },
      inspections: true,
      procurement: { with: { payments: true } },
      batchLinks: { with: { batch: { columns: { code: true } } } },
    },
  });
}

export async function recordReceipt(actor: Actor, raw: unknown) {
  const r = receiptInput.parse(raw);
  return db.transaction(async (tx) => {
    const center = await tx.query.collectionCenters.findFirst({ where: eq(schema.collectionCenters.id, r.collectionCenterId) });
    if (!center) throw new OpsError("Unknown centre");
    const farm = await tx.query.farms.findFirst({ where: eq(schema.farms.farmerId, r.farmerId) });
    const [{ n }] = (await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.collectionReceipts)
      .where(like(schema.collectionReceipts.receiptNo, `RC-${center.code}-%`))) as [{ n: number }];
    const receiptNo = `RC-${center.code}-${String(2000 + n + 1)}`;
    const [row] = await tx
      .insert(schema.collectionReceipts)
      .values({
        receiptNo,
        farmerId: r.farmerId,
        farmId: farm?.id ?? null,
        collectionCenterId: r.collectionCenterId,
        commodity: r.commodity,
        harvestDate: r.harvestDate,
        grossGrams: kgToG(r.grossKg),
        tareGrams: kgToG(r.tareKg),
        netGrams: kgToG(r.grossKg - r.tareKg),
        moisturePct: r.moisturePct != null ? r.moisturePct.toFixed(2) : null,
        receivedAt: new Date(),
        receivedBy: r.receivedBy ?? actor.label,
        notes: r.notes,
      })
      .returning();
    await writeAudit(actor, { action: "receipt.create", entityType: "receipt", entityId: row!.id, summary: `${actor.label} recorded receipt ${receiptNo}: ${r.commodity}, ${(r.grossKg - r.tareKg).toFixed(1)} kg net at ${center.code}` }, tx);
    return row!;
  });
}

export const inspectionInput = z.object({
  visualGrade: z.enum(["A", "B", "C", "ungraded"]),
  moisturePct: z.coerce.number().min(0).max(100).optional().nullable(),
  foreignMatterPct: z.coerce.number().min(0).max(100).optional().nullable(),
  acceptedKg: z.coerce.number().min(0).max(100_000),
  result: z.enum(["pass", "hold", "fail"]),
  inspector: optional(80),
  notes: optional(1000),
});

export async function inspectReceipt(actor: Actor, receiptId: string, raw: unknown) {
  const i = inspectionInput.parse(raw);
  await db.transaction(async (tx) => {
    const r = await tx.query.collectionReceipts.findFirst({ where: eq(schema.collectionReceipts.id, receiptId) });
    if (!r) throw new OpsError("Receipt not found");
    if (r.status === "procured") throw new OpsError("This receipt has already been procured");
    if (kgToG(i.acceptedKg) > r.netGrams) throw new OpsError("Accepted weight can’t exceed net weight");
    await tx.insert(schema.inspections).values({
      receiptId,
      inspectedAt: new Date(),
      inspector: i.inspector ?? actor.label,
      visualGrade: i.visualGrade,
      moisturePct: i.moisturePct != null ? i.moisturePct.toFixed(2) : null,
      foreignMatterPct: i.foreignMatterPct != null ? i.foreignMatterPct.toFixed(2) : null,
      acceptedGrams: i.result === "fail" ? 0 : kgToG(i.acceptedKg),
      result: i.result,
      notes: i.notes,
    });
    const status = i.result === "pass" ? "accepted" : i.result === "fail" ? "rejected" : "inspected";
    await tx.update(schema.collectionReceipts).set({ status }).where(eq(schema.collectionReceipts.id, receiptId));
    await writeAudit(actor, { action: "receipt.inspect", entityType: "receipt", entityId: receiptId, summary: `${actor.label} inspected ${r.receiptNo}: ${i.result.toUpperCase()}, grade ${i.visualGrade}, ${i.acceptedKg} kg accepted` }, tx);
  });
}

/** Buy the accepted quantity at the active, approved rate for that centre and commodity. */
export async function procureReceipt(actor: Actor, receiptId: string) {
  await db.transaction(async (tx) => {
    const r = await tx.query.collectionReceipts.findFirst({
      where: eq(schema.collectionReceipts.id, receiptId),
      with: { inspections: { orderBy: [desc(schema.inspections.inspectedAt)], limit: 1 }, procurement: true },
    });
    if (!r) throw new OpsError("Receipt not found");
    if (r.procurement) throw new OpsError("Already procured");
    const insp = r.inspections[0];
    if (!insp || insp.result !== "pass") throw new OpsError("Only receipts that passed inspection can be procured");
    const rule = await tx.query.pricingRules.findFirst({
      where: and(
        eq(schema.pricingRules.kind, "procurement_rate"),
        eq(schema.pricingRules.active, true),
        eq(schema.pricingRules.collectionCenterId, r.collectionCenterId),
        eq(schema.pricingRules.commodity, r.commodity),
      ),
    });
    if (!rule?.ratePerKgMinor) throw new OpsError(`No approved rate for “${r.commodity}” at this centre. Add one under Pricing.`);
    const mult = rule.gradeMultipliers?.[insp.visualGrade] ?? 1;
    const rate = Math.round(rule.ratePerKgMinor * mult);
    const accepted = insp.acceptedGrams ?? 0;
    const total = Math.round((accepted / 1000) * rate);
    const [p] = await tx
      .insert(schema.procurements)
      .values({ receiptId, pricingRuleId: rule.id, acceptedGrams: accepted, ratePerKgMinor: rate, totalMinor: total, procuredAt: new Date() })
      .returning();
    await tx.insert(schema.farmerPayments).values({ farmerId: r.farmerId, procurementId: p!.id, amountMinor: total, status: "pending" });
    await tx.update(schema.collectionReceipts).set({ status: "procured" }).where(eq(schema.collectionReceipts.id, receiptId));
    await writeAudit(actor, { action: "receipt.procure", entityType: "receipt", entityId: receiptId, summary: `${actor.label} procured ${r.receiptNo}: ${(accepted / 1000).toFixed(1)} kg × NPR ${(rate / 100).toFixed(2)}/kg = NPR ${(total / 100).toLocaleString("en-IN")}` }, tx);
  });
}

export async function markPaymentPaid(actor: Actor, paymentId: string, method: string, reference: string) {
  const m = z.string().trim().min(2, "Payment method is required").max(60).parse(method);
  const ref = z.string().trim().max(80).parse(reference);
  await db.transaction(async (tx) => {
    const p = await tx.query.farmerPayments.findFirst({ where: eq(schema.farmerPayments.id, paymentId), with: { farmer: { columns: { code: true } } } });
    if (!p) throw new OpsError("Payment not found");
    if (p.status === "paid") throw new OpsError("Already marked paid");
    await tx.update(schema.farmerPayments).set({ status: "paid", method: m, reference: ref || null, paidAt: new Date() }).where(eq(schema.farmerPayments.id, paymentId));
    await writeAudit(actor, { action: "payment.paid", entityType: "payment", entityId: paymentId, summary: `${actor.label} recorded payment of NPR ${(p.amountMinor / 100).toLocaleString("en-IN")} to ${p.farmer.code} (${m})` }, tx);
  });
}

/* ───────────────────────── Batches & trace ───────────────────────── */

export async function listBatches() {
  return db.query.batches.findMany({
    orderBy: [desc(schema.batches.createdAt)],
    with: { product: { columns: { name: true, slug: true } }, collectionCenter: { columns: { code: true } }, events: { columns: { id: true } }, qualityTests: { columns: { id: true } } },
  });
}

export async function getBatch(id: string) {
  return db.query.batches.findFirst({
    where: eq(schema.batches.id, id),
    with: {
      product: { columns: { id: true, name: true, slug: true } },
      collectionCenter: true,
      events: { orderBy: [asc(schema.traceabilityEvents.occurredAt)] },
      qualityTests: { orderBy: [asc(schema.qualityTests.testedAt)] },
      processingRuns: { orderBy: [asc(schema.processingRuns.startedAt)], with: { location: { columns: { name: true } } } },
      receiptLinks: { with: { receipt: { with: { farmer: { columns: { code: true, fullName: true } }, inspections: true } } } },
    },
  });
}

export const batchInput = z.object({
  collectionCenterId: z.string().uuid("Choose the originating centre"),
  commodity: z.string().trim().min(2).max(80),
  receiptIds: z.array(z.string().uuid()).min(1, "Select at least one procured receipt"),
  productId: z
    .string()
    .optional()
    .transform((v) => v || null),
  publicSummary: optional(400),
});

export async function nextBatchCode(tx: typeof db, centerCode: string, date = new Date()) {
  const yy = String(date.getFullYear()).slice(2);
  const rows = await tx
    .select({ code: schema.batches.code })
    .from(schema.batches)
    .where(like(schema.batches.code, `HIM-${yy}-${centerCode}-%`));
  const max = rows.reduce((m, r) => Math.max(m, Number(r.code.slice(-5)) || 0), 0);
  return `HIM-${yy}-${centerCode}-${String(max + 1).padStart(5, "0")}`;
}

export async function createBatch(actor: Actor, raw: unknown) {
  const b = batchInput.parse(raw);
  return db.transaction(async (tx) => {
    const center = await tx.query.collectionCenters.findFirst({ where: eq(schema.collectionCenters.id, b.collectionCenterId) });
    if (!center) throw new OpsError("Unknown centre");
    const receipts = await tx.query.collectionReceipts.findMany({
      where: inArray(schema.collectionReceipts.id, b.receiptIds),
      with: { procurement: true, batchLinks: true, farm: true },
    });
    if (receipts.length !== b.receiptIds.length) throw new OpsError("Some receipts were not found");
    for (const r of receipts) {
      if (!r.procurement) throw new OpsError(`${r.receiptNo} has not been procured yet`);
      if (r.batchLinks.length) throw new OpsError(`${r.receiptNo} is already in a batch`);
    }
    const accepted = receipts.reduce((s, r) => s + (r.procurement?.acceptedGrams ?? 0), 0);
    const net = receipts.reduce((s, r) => s + r.netGrams, 0);
    const harvest = receipts.map((r) => r.harvestDate).filter(Boolean).sort()[0] ?? null;
    const code = await nextBatchCode(tx as unknown as typeof db, center.code);
    const [batch] = await tx
      .insert(schema.batches)
      .values({
        code,
        commodity: b.commodity,
        productId: b.productId,
        collectionCenterId: center.id,
        originDistrict: receipts[0]?.farm?.district ?? center.district,
        harvestDate: harvest,
        stage: "verified",
        inputGrams: accepted,
        publicSummary: b.publicSummary,
        isPublic: false,
      })
      .returning();
    await tx.insert(schema.batchReceipts).values(receipts.map((r) => ({ batchId: batch!.id, receiptId: r.id })));
    const last = receipts.map((r) => r.receivedAt).sort((a, z) => z.getTime() - a.getTime())[0] ?? new Date();
    await tx.insert(schema.traceabilityEvents).values([
      { batchId: batch!.id, stage: "origin", occurredAt: harvest ? new Date(`${harvest}T09:00:00+05:45`) : last, title: `Harvested in ${batch!.originDistrict ?? center.district}`, publicDescription: `${new Set(receipts.map((r) => r.farmerId)).size} producer(s) contributed to this batch.`, locationLabel: `${batch!.originDistrict} district`, district: batch!.originDistrict, metrics: { producers: new Set(receipts.map((r) => r.farmerId)).size } },
      { batchId: batch!.id, stage: "collected", occurredAt: last, title: `Weighed at ${center.name}`, publicDescription: "Each delivery was weighed gross and net and issued a numbered receipt.", locationLabel: center.name, lat: center.lat, lng: center.lng, metrics: { netKg: Math.round(net / 100) / 10, receipts: receipts.length } },
      { batchId: batch!.id, stage: "verified", occurredAt: new Date(), title: "Accepted after inspection", publicDescription: "Only the accepted quantity was purchased, at the approved centre rate.", locationLabel: center.name, lat: center.lat, lng: center.lng, metrics: { acceptedKg: Math.round(accepted / 100) / 10 } },
    ]);
    if (b.productId) await tx.update(schema.products).set({ primaryBatchId: batch!.id }).where(eq(schema.products.id, b.productId));
    await writeAudit(actor, { action: "batch.create", entityType: "batch", entityId: batch!.id, summary: `${actor.label} formed batch ${code} from ${receipts.length} receipt(s), ${(accepted / 1000).toFixed(1)} kg` }, tx);
    return batch!;
  });
}

export const eventInput = z.object({
  stage: z.enum(["origin", "collected", "inspected", "verified", "processed", "packaged", "available", "sold_out"]),
  occurredAt: z.string().min(8),
  title: z.string().trim().min(3).max(160),
  publicDescription: optional(600),
  privateNotes: optional(1000),
  locationLabel: optional(120),
  isPublic: z.coerce.boolean().default(true),
  metricKey: optional(30),
  metricValue: z.coerce.number().optional().nullable(),
});

const STAGE_ORDER = ["origin", "collected", "inspected", "verified", "processed", "packaged", "available", "sold_out"] as const;

export async function addTraceEvent(actor: Actor, batchId: string, raw: unknown) {
  const e = eventInput.parse(raw);
  await db.transaction(async (tx) => {
    const b = await tx.query.batches.findFirst({ where: eq(schema.batches.id, batchId) });
    if (!b) throw new OpsError("Batch not found");
    await tx.insert(schema.traceabilityEvents).values({
      batchId,
      stage: e.stage,
      occurredAt: new Date(e.occurredAt),
      title: e.title,
      publicDescription: e.publicDescription,
      privateNotes: e.privateNotes,
      locationLabel: e.locationLabel,
      isPublic: e.isPublic,
      metrics: e.metricKey && e.metricValue != null ? { [e.metricKey]: e.metricValue } : {},
    });
    if (STAGE_ORDER.indexOf(e.stage) > STAGE_ORDER.indexOf(b.stage)) {
      await tx.update(schema.batches).set({ stage: e.stage }).where(eq(schema.batches.id, batchId));
    }
    await writeAudit(actor, { action: "trace.event", entityType: "batch", entityId: batchId, summary: `${actor.label} added “${e.title}” (${e.stage}) to ${b.code}` }, tx);
  });
}

export async function setBatchPublic(actor: Actor, batchId: string, isPublic: boolean) {
  await db.transaction(async (tx) => {
    const b = await tx.query.batches.findFirst({ where: eq(schema.batches.id, batchId), columns: { code: true } });
    if (!b) throw new OpsError("Batch not found");
    await tx.update(schema.batches).set({ isPublic }).where(eq(schema.batches.id, batchId));
    await writeAudit(actor, { action: isPublic ? "batch.publish" : "batch.unpublish", entityType: "batch", entityId: batchId, summary: `${actor.label} ${isPublic ? "published" : "hid"} the trace page for ${b.code}` }, tx);
  });
}

export const runInput = z.object({
  process: z.string().trim().min(2).max(80),
  inputKg: z.coerce.number().positive(),
  outputKg: z.coerce.number().min(0).optional().nullable(),
  notes: optional(600),
  unitsPacked: z.coerce.number().int().min(0).optional().nullable(),
});

export async function addProcessingRun(actor: Actor, batchId: string, raw: unknown) {
  const r = runInput.parse(raw);
  await db.transaction(async (tx) => {
    const b = await tx.query.batches.findFirst({ where: eq(schema.batches.id, batchId) });
    if (!b) throw new OpsError("Batch not found");
    const loc = await tx.query.inventoryLocations.findFirst({ where: eq(schema.inventoryLocations.kind, "processing") });
    const [{ n }] = (await tx.select({ n: sql<number>`count(*)::int` }).from(schema.processingRuns).where(eq(schema.processingRuns.batchId, batchId))) as [{ n: number }];
    await tx.insert(schema.processingRuns).values({
      code: `PR-${b.code.slice(-5)}-${n + 1}`,
      batchId,
      locationId: loc?.id ?? null,
      process: r.process,
      startedAt: new Date(),
      completedAt: r.outputKg != null ? new Date() : null,
      inputGrams: kgToG(r.inputKg),
      outputGrams: r.outputKg != null ? kgToG(r.outputKg) : null,
      notes: r.notes,
    });
    await tx
      .update(schema.batches)
      .set({
        outputGrams: r.outputKg != null ? kgToG(r.outputKg) : b.outputGrams,
        unitsPacked: r.unitsPacked ?? b.unitsPacked,
        stage: STAGE_ORDER.indexOf("processed") > STAGE_ORDER.indexOf(b.stage) ? "processed" : b.stage,
      })
      .where(eq(schema.batches.id, batchId));
    await writeAudit(actor, { action: "batch.processing", entityType: "batch", entityId: batchId, summary: `${actor.label} logged ${r.process} for ${b.code}: ${r.inputKg} kg in${r.outputKg != null ? ` → ${r.outputKg} kg out` : ""}` }, tx);
  });
}

export const testInput = z.object({
  testType: z.string().trim().min(2).max(80),
  method: optional(120),
  resultValue: z.coerce.number().optional().nullable(),
  resultUnit: optional(20),
  limitText: optional(60),
  passed: z.coerce.boolean(),
  performedBy: z.string().trim().min(2, "Say who performed the check (e.g. In-house, or the lab’s name)").max(120),
  documentMediaId: z
    .string()
    .optional()
    .transform((v) => v || null),
  isPublic: z.coerce.boolean().default(true),
});

export async function addQualityTest(actor: Actor, batchId: string, raw: unknown) {
  const t = testInput.parse(raw);
  await db.transaction(async (tx) => {
    const b = await tx.query.batches.findFirst({ where: eq(schema.batches.id, batchId), columns: { code: true } });
    if (!b) throw new OpsError("Batch not found");
    await tx.insert(schema.qualityTests).values({
      batchId,
      testType: t.testType,
      method: t.method,
      resultValue: t.resultValue != null ? String(t.resultValue) : null,
      resultUnit: t.resultUnit,
      limitText: t.limitText,
      passed: t.passed,
      performedBy: t.performedBy,
      testedAt: new Date(),
      documentMediaId: t.documentMediaId,
      isPublic: t.isPublic,
    });
    await writeAudit(actor, { action: "quality.test", entityType: "batch", entityId: batchId, summary: `${actor.label} recorded ${t.testType} for ${b.code}: ${t.passed ? "within limit" : "outside limit"}${t.documentMediaId ? " (report attached)" : ""}` }, tx);
  });
}
