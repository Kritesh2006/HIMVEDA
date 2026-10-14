import "server-only";
import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db, schema, type DB } from "@/server/db";
import { writeAudit, type Actor } from "@/server/audit";
import { toMajor, toMinor } from "@/lib/currency/config";
import { describeChanges } from "./diff";
import { productInput, type ProductInput } from "./input";

export { describeChanges };

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

export class CatalogError extends Error {}

/** Load a product as the editor's input shape (live values, or the pending draft). */
export async function loadProductInput(productId: string, { preferDraft = true } = {}) {
  const row = await db.query.products.findFirst({
    where: eq(schema.products.id, productId),
    with: {
      variants: { orderBy: [asc(schema.productVariants.sortOrder)], with: { regionalPrices: true } },
      media: { orderBy: [asc(schema.productMedia.sortOrder)] },
    },
  });
  if (!row) return null;
  const live: ProductInput = {
    name: row.name,
    slug: row.slug,
    categoryId: row.categoryId,
    shortDescription: row.shortDescription,
    description: row.description,
    unit: row.unit,
    originCountry: row.originCountry,
    district: row.district,
    producerId: row.producerId,
    collectionCenterId: row.collectionCenterId,
    primaryBatchId: row.primaryBatchId,
    harvestDate: row.harvestDate,
    qualityGrade: row.qualityGrade,
    verificationStatus: row.verificationStatus,
    processingInfo: row.processingInfo,
    visual: row.visual as ProductInput["visual"],
    featured: row.featured,
    mediaIds: row.media.map((m) => m.mediaId),
    variants: row.variants.map((v) => ({
      id: v.id,
      label: v.label,
      sku: v.sku,
      weightGrams: v.weightGrams,
      basePriceNpr: toMajor(v.basePriceMinor, "NPR"),
      stock: v.stock,
      isDefault: v.isDefault,
      active: v.active,
      regionalPrices: v.regionalPrices.map((r) => ({ currency: r.currency, amount: toMajor(r.amountMinor, r.currency) })),
    })),
  };
  const draft = preferDraft && row.draft ? productInput.safeParse(row.draft) : null;
  return {
    product: row,
    live,
    input: draft?.success ? draft.data : live,
    hasDraft: Boolean(row.draft),
  };
}

/* ───────────────────────── Write path ───────────────────────── */

async function assertUniqueSlug(tx: Tx, slug: string, exceptId?: string) {
  const hit = await tx.query.products.findFirst({ where: eq(schema.products.slug, slug), columns: { id: true } });
  if (hit && hit.id !== exceptId) throw new CatalogError(`Another product already uses the slug “${slug}”.`);
}

async function assertUniqueSkus(tx: Tx, input: ProductInput, productId?: string) {
  const skus = input.variants.map((v) => v.sku);
  const hits = await tx
    .select({ sku: schema.productVariants.sku, productId: schema.productVariants.productId })
    .from(schema.productVariants)
    .where(inArray(schema.productVariants.sku, skus));
  const clash = hits.find((h) => h.productId !== productId);
  if (clash) throw new CatalogError(`SKU “${clash.sku}” is already used by another product.`);
}

/** Apply a validated input to the live tables. The only code path that writes prices. */
async function applyInput(tx: Tx, productId: string, input: ProductInput) {
  await assertUniqueSlug(tx, input.slug, productId);
  await assertUniqueSkus(tx, input, productId);

  await tx
    .update(schema.products)
    .set({
      name: input.name,
      slug: input.slug,
      categoryId: input.categoryId,
      shortDescription: input.shortDescription,
      description: input.description,
      unit: input.unit,
      originCountry: input.originCountry,
      district: input.district,
      producerId: input.producerId,
      collectionCenterId: input.collectionCenterId,
      primaryBatchId: input.primaryBatchId,
      harvestDate: input.harvestDate,
      qualityGrade: input.qualityGrade,
      verificationStatus: input.verificationStatus,
      processingInfo: input.processingInfo,
      visual: input.visual,
      featured: input.featured,
    })
    .where(eq(schema.products.id, productId));

  // Variants: update in place by id (keeps order history intact), insert new, remove dropped.
  const existing = await tx.select().from(schema.productVariants).where(eq(schema.productVariants.productId, productId));
  const keepIds: string[] = [];
  const hasDefault = input.variants.some((v) => v.isDefault);
  for (const [i, v] of input.variants.entries()) {
    const match = existing.find((e) => e.id === v.id) ?? existing.find((e) => e.sku === v.sku);
    const values = {
      label: v.label,
      sku: v.sku,
      weightGrams: v.weightGrams ?? null,
      basePriceMinor: toMinor(v.basePriceNpr, "NPR"),
      stock: v.stock,
      isDefault: hasDefault ? v.isDefault : i === 0,
      active: v.active,
      sortOrder: i,
    };
    let variantId: string;
    if (match) {
      await tx.update(schema.productVariants).set(values).where(eq(schema.productVariants.id, match.id));
      variantId = match.id;
      if (match.stock !== v.stock) {
        await tx.insert(schema.inventoryMovements).values({
          variantId,
          quantity: v.stock - match.stock,
          quantityUnit: "unit",
          reason: "stock_adjustment",
          reference: "product editor",
        });
      }
    } else {
      const [row] = await tx.insert(schema.productVariants).values({ ...values, productId }).returning({ id: schema.productVariants.id });
      variantId = row!.id;
    }
    keepIds.push(variantId);

    await tx.delete(schema.regionalPrices).where(eq(schema.regionalPrices.variantId, variantId));
    if (v.regionalPrices.length) {
      await tx.insert(schema.regionalPrices).values(
        v.regionalPrices.map((r) => ({ variantId, currency: r.currency, amountMinor: toMinor(r.amount, r.currency) })),
      );
    }
  }
  if (keepIds.length) {
    await tx
      .delete(schema.productVariants)
      .where(and(eq(schema.productVariants.productId, productId), notInArray(schema.productVariants.id, keepIds)));
  }

  await tx.delete(schema.productMedia).where(eq(schema.productMedia.productId, productId));
  if (input.mediaIds.length) {
    await tx.insert(schema.productMedia).values(input.mediaIds.map((mediaId, i) => ({ productId, mediaId, sortOrder: i })));
  }
}

export async function createProduct(actor: Actor, raw: unknown): Promise<{ id: string; slug: string }> {
  const input = productInput.parse(raw);
  return db.transaction(async (tx) => {
    await assertUniqueSlug(tx, input.slug);
    await assertUniqueSkus(tx, input);
    const [row] = await tx
      .insert(schema.products)
      .values({ name: input.name, slug: input.slug, status: "draft" })
      .returning({ id: schema.products.id });
    await applyInput(tx, row!.id, input);
    await writeAudit(
      actor,
      {
        action: "product.create",
        entityType: "product",
        entityId: row!.id,
        summary: `${actor.label} created product “${input.name}” (draft) at ${input.variants
          .map((v) => `${v.label} NPR ${v.basePriceNpr.toLocaleString("en-IN")}`)
          .join(", ")}`,
        after: input,
      },
      tx,
    );
    return { id: row!.id, slug: input.slug };
  });
}

/**
 * Save Draft. Unpublished products are updated directly (nothing public changes).
 * Published products store the edit as a pending draft, leaving the live page untouched until Publish.
 */
export async function saveProductDraft(actor: Actor, productId: string, raw: unknown) {
  const input = productInput.parse(raw);
  const current = await loadProductInput(productId, { preferDraft: false });
  if (!current) throw new CatalogError("Product not found");
  await db.transaction(async (tx) => {
    await assertUniqueSlug(tx, input.slug, productId);
    await assertUniqueSkus(tx, input, productId);
    if (current.product.status === "published") {
      await tx
        .update(schema.products)
        .set({ draft: input as unknown as Record<string, unknown>, draftUpdatedAt: new Date() })
        .where(eq(schema.products.id, productId));
      await writeAudit(
        actor,
        {
          action: "product.draft.save",
          entityType: "product",
          entityId: productId,
          summary: `${actor.label} saved a draft of “${input.name}”${summarise(describeChanges(current.live, input))}`,
          after: input,
        },
        tx,
      );
    } else {
      await applyInput(tx, productId, input);
      await tx.update(schema.products).set({ draft: null, draftUpdatedAt: null }).where(eq(schema.products.id, productId));
      await writeAudit(
        actor,
        {
          action: "product.update",
          entityType: "product",
          entityId: productId,
          summary: `${actor.label} updated unpublished “${input.name}”${summarise(describeChanges(current.live, input))}`,
          before: current.live,
          after: input,
        },
        tx,
      );
    }
  });
}

/** Publish: apply any pending draft (or the supplied input) to the live record and make it public. */
export async function publishProduct(actor: Actor, productId: string, raw?: unknown) {
  const current = await loadProductInput(productId, { preferDraft: true });
  if (!current) throw new CatalogError("Product not found");
  const input = raw ? productInput.parse(raw) : productInput.parse(current.input);
  const changes = describeChanges(current.live, input);
  await db.transaction(async (tx) => {
    await applyInput(tx, productId, input);
    await tx
      .update(schema.products)
      .set({
        status: "published",
        draft: null,
        draftUpdatedAt: null,
        publishedAt: current.product.publishedAt ?? new Date(),
      })
      .where(eq(schema.products.id, productId));
    const wasLive = current.product.status === "published";
    await writeAudit(
      actor,
      {
        action: wasLive ? "product.publish.changes" : "product.publish",
        entityType: "product",
        entityId: productId,
        summary: wasLive
          ? `${actor.label} published changes to “${input.name}”${summarise(changes)}`
          : `${actor.label} published “${input.name}”${summarise(changes)}`,
        before: current.live,
        after: input,
      },
      tx,
    );
  });
}

export async function unpublishProduct(actor: Actor, productId: string) {
  const p = await db.query.products.findFirst({ where: eq(schema.products.id, productId), columns: { name: true, status: true } });
  if (!p) throw new CatalogError("Product not found");
  await db.transaction(async (tx) => {
    await tx.update(schema.products).set({ status: "draft" }).where(eq(schema.products.id, productId));
    await writeAudit(actor, { action: "product.unpublish", entityType: "product", entityId: productId, summary: `${actor.label} unpublished “${p.name}”` }, tx);
  });
}

export async function discardProductDraft(actor: Actor, productId: string) {
  const p = await db.query.products.findFirst({ where: eq(schema.products.id, productId), columns: { name: true } });
  if (!p) throw new CatalogError("Product not found");
  await db.transaction(async (tx) => {
    await tx.update(schema.products).set({ draft: null, draftUpdatedAt: null }).where(eq(schema.products.id, productId));
    await writeAudit(actor, { action: "product.draft.discard", entityType: "product", entityId: productId, summary: `${actor.label} discarded the pending draft of “${p.name}”` }, tx);
  });
}

export async function archiveProduct(actor: Actor, productId: string) {
  const p = await db.query.products.findFirst({ where: eq(schema.products.id, productId), columns: { name: true } });
  if (!p) throw new CatalogError("Product not found");
  await db.transaction(async (tx) => {
    await tx.update(schema.products).set({ status: "archived", featured: false }).where(eq(schema.products.id, productId));
    await writeAudit(actor, { action: "product.archive", entityType: "product", entityId: productId, summary: `${actor.label} archived “${p.name}”` }, tx);
  });
}

/** Quick stock adjustment from the Inventory screen (records a movement). */
export async function adjustStock(actor: Actor, variantId: string, delta: number, reason: string) {
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100_000) throw new CatalogError("Enter a whole-number adjustment");
  await db.transaction(async (tx) => {
    const v = await tx.query.productVariants.findFirst({ where: eq(schema.productVariants.id, variantId), with: { product: { columns: { name: true } } } });
    if (!v) throw new CatalogError("Variant not found");
    if (v.stock + delta < 0) throw new CatalogError("Stock cannot go below zero");
    await tx
      .update(schema.productVariants)
      .set({ stock: sql`${schema.productVariants.stock} + ${delta}` })
      .where(eq(schema.productVariants.id, variantId));
    await tx.insert(schema.inventoryMovements).values({
      variantId,
      quantity: delta,
      quantityUnit: "unit",
      reason: "stock_adjustment",
      reference: reason.slice(0, 120) || null,
      actorLabel: actor.label,
    });
    await writeAudit(
      actor,
      {
        action: "inventory.adjust",
        entityType: "variant",
        entityId: variantId,
        summary: `${actor.label} adjusted ${v.product.name} · ${v.label} stock ${v.stock} → ${v.stock + delta}${reason ? ` (${reason})` : ""}`,
        before: { stock: v.stock },
        after: { stock: v.stock + delta },
      },
      tx,
    );
  });
}

function summarise(changes: string[]) {
  if (!changes.length) return "";
  const head = changes.slice(0, 3).join("; ");
  return ` — ${head}${changes.length > 3 ? ` (+${changes.length - 3} more)` : ""}`;
}
