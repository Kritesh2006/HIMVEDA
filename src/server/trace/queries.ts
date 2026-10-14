import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";

export const BATCH_CODE = /^HIM-\d{2}-[A-Z]{3}-\d{5}$/;

export const STAGES = ["origin", "collected", "inspected", "verified", "processed", "packaged", "available"] as const;
export type Stage = (typeof STAGES)[number] | "sold_out";

export interface PublicTrace {
  code: string;
  commodity: string;
  stage: Stage;
  originDistrict: string | null;
  harvestDate: string | null;
  qualityGrade: string;
  inputKg: number | null;
  outputKg: number | null;
  unitsPacked: number | null;
  publicSummary: string | null;
  isDemo: boolean;
  producerCount: number;
  origin: { lat: number; lng: number } | null;
  product: { slug: string; name: string } | null;
  center: { code: string; name: string; district: string; lat: number | null; lng: number | null } | null;
  events: {
    stage: Stage;
    occurredAt: string;
    title: string;
    description: string | null;
    location: string | null;
    district: string | null;
    lat: number | null;
    lng: number | null;
    metrics: Record<string, number | string>;
  }[];
  tests: {
    testType: string;
    method: string | null;
    value: number | null;
    unit: string | null;
    limit: string | null;
    passed: boolean;
    performedBy: string | null;
    testedAt: string;
    documentId: string | null;
  }[];
}

const num = (v: string | null | undefined) => (v == null ? null : Number(v));

/**
 * Public trace view. Strictly allow-listed fields: never producer names (unless
 * consented), phone numbers, payments, procurement prices or private notes.
 * Origin coordinates are aggregated and rounded to ~10 km.
 */
export async function getPublicTrace(code: string): Promise<PublicTrace | null> {
  const normalized = code.trim().toUpperCase();
  if (!BATCH_CODE.test(normalized)) return null;
  const b = await db.query.batches.findFirst({
    where: and(eq(schema.batches.code, normalized), eq(schema.batches.isPublic, true)),
    with: {
      product: { columns: { slug: true, name: true, status: true } },
      collectionCenter: { columns: { code: true, name: true, district: true, lat: true, lng: true, isPublic: true } },
      events: { where: eq(schema.traceabilityEvents.isPublic, true), orderBy: [asc(schema.traceabilityEvents.occurredAt)] },
      qualityTests: { where: eq(schema.qualityTests.isPublic, true), orderBy: [asc(schema.qualityTests.testedAt)] },
      receiptLinks: {
        with: { receipt: { columns: { farmerId: true }, with: { farm: { columns: { approxLat: true, approxLng: true } } } } },
      },
    },
  });
  if (!b) return null;

  const farms = b.receiptLinks.map((l) => l.receipt.farm).filter((f): f is NonNullable<typeof f> => Boolean(f?.approxLat && f?.approxLng));
  const origin = farms.length
    ? {
        lat: Math.round((farms.reduce((s, f) => s + Number(f.approxLat), 0) / farms.length) * 10) / 10,
        lng: Math.round((farms.reduce((s, f) => s + Number(f.approxLng), 0) / farms.length) * 10) / 10,
      }
    : null;

  return {
    code: b.code,
    commodity: b.commodity,
    stage: b.stage,
    originDistrict: b.originDistrict,
    harvestDate: b.harvestDate,
    qualityGrade: b.qualityGrade,
    inputKg: b.inputGrams ? b.inputGrams / 1000 : null,
    outputKg: b.outputGrams ? b.outputGrams / 1000 : null,
    unitsPacked: b.unitsPacked,
    publicSummary: b.publicSummary,
    isDemo: b.isDemo,
    producerCount: new Set(b.receiptLinks.map((l) => l.receipt.farmerId)).size,
    origin,
    product: b.product && b.product.status === "published" ? { slug: b.product.slug, name: b.product.name } : null,
    center:
      b.collectionCenter && b.collectionCenter.isPublic
        ? {
            code: b.collectionCenter.code,
            name: b.collectionCenter.name,
            district: b.collectionCenter.district,
            lat: num(b.collectionCenter.lat),
            lng: num(b.collectionCenter.lng),
          }
        : null,
    events: b.events.map((e) => ({
      stage: e.stage,
      occurredAt: e.occurredAt.toISOString(),
      title: e.title,
      description: e.publicDescription,
      location: e.locationLabel,
      district: e.district,
      lat: num(e.lat),
      lng: num(e.lng),
      metrics: e.metrics ?? {},
    })),
    tests: b.qualityTests.map((t) => ({
      testType: t.testType,
      method: t.method,
      value: num(t.resultValue),
      unit: t.resultUnit,
      limit: t.limitText,
      passed: t.passed,
      performedBy: t.performedBy,
      testedAt: t.testedAt.toISOString(),
      documentId: t.documentMediaId,
    })),
  };
}

export async function listPublicBatchCodes(limit = 6) {
  return db
    .select({ code: schema.batches.code, commodity: schema.batches.commodity, stage: schema.batches.stage, isDemo: schema.batches.isDemo })
    .from(schema.batches)
    .where(eq(schema.batches.isPublic, true))
    .orderBy(asc(schema.batches.code))
    .limit(limit);
}

export async function listPublicCenters() {
  return db
    .select({
      code: schema.collectionCenters.code,
      name: schema.collectionCenters.name,
      district: schema.collectionCenters.district,
      province: schema.collectionCenters.province,
      lat: schema.collectionCenters.lat,
      lng: schema.collectionCenters.lng,
      isDemo: schema.collectionCenters.isDemo,
    })
    .from(schema.collectionCenters)
    .where(and(eq(schema.collectionCenters.isPublic, true), eq(schema.collectionCenters.active, true)))
    .orderBy(asc(schema.collectionCenters.code));
}
