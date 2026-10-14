import "server-only";
import { and, asc, count, desc, eq, gt, ilike, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { writeAudit, type Actor } from "@/server/audit";
import { refreshRates } from "@/server/currency/service";
import { saveContent } from "@/server/content/service";
import { purgeDemoData } from "@/server/demo/purge";
import { isCurrencyCode } from "@/lib/currency/config";
import { OpsError } from "./agri";
import { LIMITS } from "@/server/auth/throttle";

/* ───────────────────────── Overview ───────────────────────── */

export async function getOverview() {
  const since = new Date(Date.now() - LIMITS.global.windowMs);
  const n = async (q: PromiseLike<{ n: number }[]>) => (await q)[0]?.n ?? 0;
  const [published, drafts, lowStock, openOrders, toInspect, toProcure, pendingApprovals, pendingPayments, failedAccess, unreadMessages] = await Promise.all([
    n(db.select({ n: count() }).from(schema.products).where(eq(schema.products.status, "published"))),
    n(db.select({ n: count() }).from(schema.products).where(or(eq(schema.products.status, "draft"), sql`${schema.products.draft} is not null`))),
    n(db.select({ n: count() }).from(schema.productVariants).where(and(eq(schema.productVariants.active, true), lt(schema.productVariants.stock, 10)))),
    n(db.select({ n: count() }).from(schema.orders).where(or(eq(schema.orders.status, "requested"), eq(schema.orders.status, "confirmed"), eq(schema.orders.status, "packed")))),
    n(db.select({ n: count() }).from(schema.collectionReceipts).where(eq(schema.collectionReceipts.status, "received"))),
    n(db.select({ n: count() }).from(schema.collectionReceipts).where(eq(schema.collectionReceipts.status, "accepted"))),
    n(db.select({ n: count() }).from(schema.priceApprovals).where(eq(schema.priceApprovals.status, "pending"))),
    n(db.select({ n: count() }).from(schema.farmerPayments).where(or(eq(schema.farmerPayments.status, "pending"), eq(schema.farmerPayments.status, "approved")))),
    n(db.select({ n: count() }).from(schema.accessAttempts).where(and(eq(schema.accessAttempts.success, false), gt(schema.accessAttempts.createdAt, since)))),
    n(db.select({ n: count() }).from(schema.contactMessages).where(eq(schema.contactMessages.handled, false))),
  ]);
  const recent = await db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(10);
  return { published, drafts, lowStock, openOrders, toInspect, toProcure, pendingApprovals, pendingPayments, failedAccess, unreadMessages, lockdownAt: LIMITS.global.failures, recent };
}

/* ───────────────────────── Pricing ───────────────────────── */

export async function getPricing() {
  const [rates, rules, approvals, centers] = await Promise.all([
    db.select().from(schema.currencyRates).orderBy(asc(schema.currencyRates.currency)),
    db.query.pricingRules.findMany({ orderBy: [asc(schema.pricingRules.kind), asc(schema.pricingRules.name)], with: { collectionCenter: { columns: { code: true } } } }),
    db.query.priceApprovals.findMany({ orderBy: [desc(schema.priceApprovals.createdAt)], limit: 30, with: { pricingRule: { columns: { name: true } } } }),
    db.select({ id: schema.collectionCenters.id, code: schema.collectionCenters.code, name: schema.collectionCenters.name }).from(schema.collectionCenters).orderBy(asc(schema.collectionCenters.code)),
  ]);
  return { rates, rules, approvals, centers };
}

export async function refreshFx(actor: Actor) {
  const r = await refreshRates();
  await writeAudit(actor, { action: "fx.refresh", entityType: "currency", summary: `${actor.label} refreshed exchange rates from ${r.source}${r.error ? ` (provider error: ${r.error})` : ""}` });
  return r;
}

export async function setRounding(actor: Actor, currency: string, rounding: string) {
  if (!isCurrencyCode(currency)) throw new OpsError("Unknown currency");
  const mode = z.enum(["none", "whole", "half", "charm_99"]).parse(rounding);
  await db.transaction(async (tx) => {
    const existing = await tx.query.pricingRules.findFirst({ where: and(eq(schema.pricingRules.kind, "display_rounding"), eq(schema.pricingRules.currency, currency)) });
    if (existing) await tx.update(schema.pricingRules).set({ rounding: mode }).where(eq(schema.pricingRules.id, existing.id));
    else await tx.insert(schema.pricingRules).values({ kind: "display_rounding", name: `${currency} display rounding`, currency, rounding: mode });
    await writeAudit(actor, { action: "pricing.rounding", entityType: "currency", entityId: currency, summary: `${actor.label} set ${currency} display rounding to “${mode}”`, before: { rounding: existing?.rounding ?? "none" }, after: { rounding: mode } }, tx);
  });
}

export const rateRuleInput = z.object({
  commodity: z.string().trim().min(2).max(80),
  collectionCenterId: z.string().uuid("Choose a centre"),
  ratePerKg: z.coerce.number().positive().max(1_000_000),
});

/** A new procurement rate starts inactive with a pending approval — a second editor must approve it. */
export async function createRateRule(actor: Actor, raw: unknown) {
  const r = rateRuleInput.parse(raw);
  await db.transaction(async (tx) => {
    const center = await tx.query.collectionCenters.findFirst({ where: eq(schema.collectionCenters.id, r.collectionCenterId), columns: { code: true } });
    const [rule] = await tx
      .insert(schema.pricingRules)
      .values({ kind: "procurement_rate", name: `${r.commodity} · ${center?.code}`, commodity: r.commodity, collectionCenterId: r.collectionCenterId, ratePerKgMinor: null, gradeMultipliers: { A: 1, B: 0.9, C: 0.8 }, active: false })
      .returning();
    await tx.insert(schema.priceApprovals).values({ pricingRuleId: rule!.id, previousMinor: null, proposedMinor: Math.round(r.ratePerKg * 100), requestedById: actor.userId, note: "New rate" });
    await writeAudit(actor, { action: "pricing.rate.propose", entityType: "pricing_rule", entityId: rule!.id, summary: `${actor.label} proposed a new rate: ${r.commodity} at ${center?.code}, NPR ${r.ratePerKg}/kg (awaiting approval)` }, tx);
  });
}

export async function proposeRate(actor: Actor, ruleId: string, ratePerKg: number, note: string) {
  const rate = z.coerce.number().positive().max(1_000_000).parse(ratePerKg);
  await db.transaction(async (tx) => {
    const rule = await tx.query.pricingRules.findFirst({ where: eq(schema.pricingRules.id, ruleId) });
    if (!rule || rule.kind !== "procurement_rate") throw new OpsError("Rule not found");
    const pending = await tx.query.priceApprovals.findFirst({ where: and(eq(schema.priceApprovals.pricingRuleId, ruleId), eq(schema.priceApprovals.status, "pending")) });
    if (pending) throw new OpsError("This rate already has a change waiting for approval");
    await tx.insert(schema.priceApprovals).values({ pricingRuleId: ruleId, previousMinor: rule.ratePerKgMinor, proposedMinor: Math.round(rate * 100), requestedById: actor.userId, note: note.slice(0, 300) || null });
    await writeAudit(actor, { action: "pricing.rate.propose", entityType: "pricing_rule", entityId: ruleId, summary: `${actor.label} proposed ${rule.name}: NPR ${((rule.ratePerKgMinor ?? 0) / 100).toFixed(2)} → NPR ${rate.toFixed(2)}/kg` }, tx);
  });
}

export async function decideRate(actor: Actor, approvalId: string, approve: boolean) {
  await db.transaction(async (tx) => {
    const a = await tx.query.priceApprovals.findFirst({ where: eq(schema.priceApprovals.id, approvalId), with: { pricingRule: true } });
    if (!a || a.status !== "pending") throw new OpsError("This request is no longer pending");
    if (a.requestedById && a.requestedById === actor.userId) throw new OpsError("A different editor must approve this change");
    await tx.update(schema.priceApprovals).set({ status: approve ? "approved" : "rejected", decidedById: actor.userId, decidedAt: new Date() }).where(eq(schema.priceApprovals.id, approvalId));
    if (approve) await tx.update(schema.pricingRules).set({ ratePerKgMinor: a.proposedMinor, active: true }).where(eq(schema.pricingRules.id, a.pricingRuleId));
    await writeAudit(
      actor,
      {
        action: approve ? "pricing.rate.approve" : "pricing.rate.reject",
        entityType: "pricing_rule",
        entityId: a.pricingRuleId,
        summary: `${actor.label} ${approve ? "approved" : "rejected"} ${a.pricingRule.name}: NPR ${((a.previousMinor ?? 0) / 100).toFixed(2)} → NPR ${(a.proposedMinor / 100).toFixed(2)}/kg`,
        before: { ratePerKgMinor: a.previousMinor },
        after: { ratePerKgMinor: approve ? a.proposedMinor : a.previousMinor },
      },
      tx,
    );
  });
}

/* ───────────────────────── Orders ───────────────────────── */

export async function listOrders() {
  return db.query.orders.findMany({ orderBy: [desc(schema.orders.createdAt)], limit: 200, with: { items: true } });
}

const ORDER_STATUS = ["requested", "confirmed", "packed", "shipped", "delivered", "cancelled"] as const;

export async function setOrderStatus(actor: Actor, orderId: string, status: string) {
  const st = z.enum(ORDER_STATUS).parse(status);
  await db.transaction(async (tx) => {
    const o = await tx.query.orders.findFirst({ where: eq(schema.orders.id, orderId), with: { items: true } });
    if (!o) throw new OpsError("Order not found");
    if (o.status === st) return;
    if (o.status === "cancelled") throw new OpsError("Cancelled orders can’t be reopened");
    await tx.update(schema.orders).set({ status: st }).where(eq(schema.orders.id, orderId));
    if (st === "cancelled") {
      // return reserved stock
      for (const i of o.items) {
        if (!i.variantId) continue;
        await tx.update(schema.productVariants).set({ stock: sql`${schema.productVariants.stock} + ${i.quantity}` }).where(eq(schema.productVariants.id, i.variantId));
        await tx.insert(schema.inventoryMovements).values({ variantId: i.variantId, quantity: i.quantity, quantityUnit: "unit", reason: "order_cancelled", reference: o.number, actorLabel: actor.label });
      }
    }
    await writeAudit(actor, { action: "order.status", entityType: "order", entityId: orderId, summary: `${actor.label} moved order ${o.number}: ${o.status} → ${st}`, before: { status: o.status }, after: { status: st } }, tx);
  });
}

/* ───────────────────────── Inventory ───────────────────────── */

export async function getInventory() {
  const [variants, movements] = await Promise.all([
    db.query.productVariants.findMany({
      orderBy: [asc(schema.productVariants.stock)],
      with: { product: { columns: { id: true, name: true, status: true, isDemo: true } } },
    }),
    db.query.inventoryMovements.findMany({
      orderBy: [desc(schema.inventoryMovements.movedAt)],
      limit: 60,
      with: {
        variant: { columns: { label: true }, with: { product: { columns: { name: true } } } },
        batch: { columns: { code: true } },
        from: { columns: { name: true } },
        to: { columns: { name: true } },
      },
    }),
  ]);
  return { variants, movements };
}

/* ───────────────────────── Users & sessions ───────────────────────── */

export async function getUsers() {
  const [users, sessions] = await Promise.all([
    db.query.users.findMany({ orderBy: [asc(schema.users.createdAt)], with: { credentials: { columns: { label: true, slot: true, active: true, lastUsedAt: true } } } }),
    db.query.adminSessions.findMany({
      where: and(isNull(schema.adminSessions.revokedAt), gt(schema.adminSessions.expiresAt, new Date())),
      orderBy: [desc(schema.adminSessions.lastSeenAt)],
      with: { credential: { columns: { label: true } } },
    }),
  ]);
  return { users, sessions };
}

export async function updateUser(actor: Actor, userId: string, raw: unknown) {
  const u = z.object({ displayName: z.string().trim().min(2).max(60), role: z.enum(["owner", "editor"]), active: z.coerce.boolean() }).parse(raw);
  if (userId === actor.userId && !u.active) throw new OpsError("You can’t deactivate yourself");
  await db.transaction(async (tx) => {
    const before = await tx.query.users.findFirst({ where: eq(schema.users.id, userId) });
    if (!before) throw new OpsError("User not found");
    await tx.update(schema.users).set(u).where(eq(schema.users.id, userId));
    await tx.update(schema.adminCredentials).set({ active: u.active }).where(eq(schema.adminCredentials.userId, userId));
    if (!u.active) await tx.update(schema.adminSessions).set({ revokedAt: new Date() }).where(and(eq(schema.adminSessions.userId, userId), isNull(schema.adminSessions.revokedAt)));
    await writeAudit(actor, { action: "user.update", entityType: "user", entityId: userId, summary: `${actor.label} updated ${before.displayName}: ${[before.displayName !== u.displayName && `name → ${u.displayName}`, before.role !== u.role && `role → ${u.role}`, before.active !== u.active && (u.active ? "reactivated" : "deactivated")].filter(Boolean).join(", ") || "no change"}`, before: { displayName: before.displayName, role: before.role, active: before.active }, after: u }, tx);
  });
}

export async function revokeSession(actor: Actor, sessionId: string) {
  await db.transaction(async (tx) => {
    await tx.update(schema.adminSessions).set({ revokedAt: new Date() }).where(eq(schema.adminSessions.id, sessionId));
    await writeAudit(actor, { action: "session.revoke", entityType: "session", entityId: sessionId, summary: `${actor.label} signed out a session` }, tx);
  });
}

/* ───────────────────────── Media ───────────────────────── */

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "application/pdf": "pdf",
};
export const MAX_UPLOAD = 4 * 1024 * 1024;

function sniff(buf: Buffer): string | null {
  if (buf.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.subarray(4, 12).toString() === "ftypavif") return "image/avif";
  if (buf.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  return null;
}

function dimensions(buf: Buffer, mime: string): { width: number; height: number } | null {
  try {
    if (mime === "image/png") return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (mime === "image/jpeg") {
      let i = 2;
      while (i < buf.length) {
        if (buf[i] !== 0xff) return null;
        const marker = buf[i + 1]!;
        const len = buf.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xc3) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        i += 2 + len;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Validates by magic bytes (never trusts the declared type), stores in Postgres. SVG is rejected (script risk). */
export async function uploadMedia(actor: Actor, file: File, alt: string) {
  if (!file || file.size === 0) throw new OpsError("Choose a file to upload");
  if (file.size > MAX_UPLOAD) throw new OpsError("Files must be 4 MB or smaller");
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf);
  if (!mime || !ALLOWED[mime]) throw new OpsError("Upload a JPEG, PNG, WebP, AVIF image or a PDF");
  const dim = dimensions(buf, mime);
  const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(0, 100) || `upload.${ALLOWED[mime]}`;
  const [row] = await db
    .insert(schema.media)
    .values({ filename: safeName, mimeType: mime, byteSize: buf.length, width: dim?.width ?? null, height: dim?.height ?? null, alt: alt.slice(0, 300), data: buf })
    .returning({ id: schema.media.id });
  await writeAudit(actor, { action: "media.upload", entityType: "media", entityId: row!.id, summary: `${actor.label} uploaded ${safeName} (${Math.round(buf.length / 1024)} KB)` });
  return row!.id;
}

export async function listMedia() {
  return db
    .select({ id: schema.media.id, filename: schema.media.filename, mimeType: schema.media.mimeType, byteSize: schema.media.byteSize, width: schema.media.width, height: schema.media.height, alt: schema.media.alt, createdAt: schema.media.createdAt })
    .from(schema.media)
    .orderBy(desc(schema.media.createdAt));
}

export async function updateMediaAlt(actor: Actor, id: string, alt: string) {
  await db.update(schema.media).set({ alt: alt.slice(0, 300) }).where(eq(schema.media.id, id));
  await writeAudit(actor, { action: "media.alt", entityType: "media", entityId: id, summary: `${actor.label} updated image description` });
}

export async function deleteMedia(actor: Actor, id: string) {
  const [used] = await db.select({ n: count() }).from(schema.productMedia).where(eq(schema.productMedia.mediaId, id));
  if ((used?.n ?? 0) > 0) throw new OpsError("This file is used by a product. Remove it from the product first.");
  const [m] = await db.delete(schema.media).where(eq(schema.media.id, id)).returning({ filename: schema.media.filename });
  await writeAudit(actor, { action: "media.delete", entityType: "media", entityId: id, summary: `${actor.label} deleted ${m?.filename ?? "a file"}` });
}

/* ───────────────────────── Settings ───────────────────────── */

export async function setDemoMode(actor: Actor, on: boolean) {
  await saveContent(actor, [{ key: "settings.demoMode", value: on }]);
}

export async function removeDemoData(actor: Actor, confirmation: string) {
  if (confirmation.trim().toUpperCase() !== "REMOVE SAMPLE DATA") throw new OpsError("Type REMOVE SAMPLE DATA to confirm");
  const counts = await purgeDemoData(db);
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  await writeAudit(actor, { action: "demo.purge", entityType: "system", summary: `${actor.label} removed all demonstration data (${total} records)`, after: counts });
  return counts;
}

/* ───────────────────────── Audit ───────────────────────── */

export async function listAudit({ q, page = 1, entity }: { q?: string; page?: number; entity?: string }) {
  const size = 50;
  const where = and(
    q ? or(ilike(schema.auditLogs.summary, `%${q}%`), ilike(schema.auditLogs.actorLabel, `%${q}%`)) : undefined,
    entity ? eq(schema.auditLogs.entityType, entity) : undefined,
  );
  const [rows, total] = await Promise.all([
    db.select().from(schema.auditLogs).where(where).orderBy(desc(schema.auditLogs.createdAt)).limit(size).offset((page - 1) * size),
    db.select({ n: count() }).from(schema.auditLogs).where(where),
  ]);
  return { rows, total: total[0]?.n ?? 0, page, pages: Math.max(1, Math.ceil((total[0]?.n ?? 0) / size)) };
}

export async function listMessages() {
  return db.select().from(schema.contactMessages).orderBy(desc(schema.contactMessages.createdAt)).limit(100);
}

export async function setMessageHandled(actor: Actor, id: string, handled: boolean) {
  await db.update(schema.contactMessages).set({ handled }).where(eq(schema.contactMessages.id, id));
  await writeAudit(actor, { action: "message.handled", entityType: "message", entityId: id, summary: `${actor.label} marked a contact message ${handled ? "handled" : "open"}` });
}
