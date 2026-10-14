import "server-only";
import { cache } from "react";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { getCurrencyContext, priceFor, type CurrencyContext } from "@/server/currency/service";
import type { Money } from "@/server/currency/pricing";
import { toMinor } from "@/lib/currency/config";
import { productInput, type ProductInput } from "./input";

const withAll = {
  category: true as const,
  producer: { columns: { publicName: true as const, publishConsent: true as const, district: true as const, isDemo: true as const } },
  collectionCenter: { columns: { id: true as const, code: true as const, name: true as const, district: true as const, isPublic: true as const, isDemo: true as const } },
  primaryBatch: { columns: { id: true as const, code: true as const, stage: true as const, isPublic: true as const } },
  variants: {
    orderBy: [asc(schema.productVariants.sortOrder), asc(schema.productVariants.createdAt)],
    with: { regionalPrices: { columns: { currency: true as const, amountMinor: true as const } } },
  },
  media: {
    orderBy: [asc(schema.productMedia.sortOrder)],
    with: { media: { columns: { id: true as const, alt: true as const, width: true as const, height: true as const } } },
  },
};

type ProductRow = NonNullable<Awaited<ReturnType<typeof fetchOne>>>;
const fetchOne = (where: ReturnType<typeof eq>) => db.query.products.findFirst({ where, with: withAll });

export interface VariantView {
  id: string;
  label: string;
  sku: string;
  weightGrams: number | null;
  stock: number;
  price: Money;
  isDefault: boolean;
}

export interface ProductCard {
  id: string;
  slug: string;
  name: string;
  category: { slug: string; name: string; nameNe: string | null } | null;
  shortDescription: string;
  visual: string;
  images: { id: string; alt: string }[];
  fromPrice: Money | null;
  hasRange: boolean;
  variantCount: number;
  totalStock: number;
  inStock: boolean;
  district: string | null;
  batchCode: string | null;
  qualityGrade: string;
  verificationStatus: string;
  featured: boolean;
  isDemo: boolean;
  createdAt: string;
}

export interface ProductDetail extends ProductCard {
  description: string;
  unit: string;
  originCountry: string;
  harvestDate: string | null;
  processingInfo: string | null;
  producerName: string | null;
  collectionCenter: { code: string; name: string; district: string } | null;
  batch: { code: string; stage: string; isPublic: boolean } | null;
  variants: VariantView[];
  status: string;
  hasDraft: boolean;
  isPreview: boolean;
}

function toCard(p: ProductRow, ctx: CurrencyContext): ProductCard {
  const active = p.variants.filter((v) => v.active);
  const priced = active.map((v) => ({ v, price: priceFor(v, ctx) }));
  priced.sort((a, b) => a.price.amountMinor - b.price.amountMinor);
  const totalStock = active.reduce((s, v) => s + v.stock, 0);
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category ? { slug: p.category.slug, name: p.category.name, nameNe: p.category.nameNe } : null,
    shortDescription: p.shortDescription,
    visual: p.visual,
    images: p.media.map((m) => ({ id: m.media.id, alt: m.media.alt || p.name })),
    fromPrice: priced[0]?.price ?? null,
    hasRange: new Set(priced.map((x) => x.price.amountMinor)).size > 1,
    variantCount: active.length,
    totalStock,
    inStock: totalStock > 0,
    district: p.district,
    batchCode: p.primaryBatch?.isPublic ? p.primaryBatch.code : null,
    qualityGrade: p.qualityGrade,
    verificationStatus: p.verificationStatus,
    featured: p.featured,
    isDemo: p.isDemo,
    createdAt: p.createdAt.toISOString(),
  };
}

function toDetail(p: ProductRow, ctx: CurrencyContext, isPreview = false): ProductDetail {
  const card = toCard(p, ctx);
  const showProducer = p.producer?.publishConsent && p.producer.publicName;
  return {
    ...card,
    description: p.description,
    unit: p.unit,
    originCountry: p.originCountry,
    harvestDate: p.harvestDate,
    processingInfo: p.processingInfo,
    producerName: showProducer ? p.producer!.publicName : null,
    collectionCenter:
      p.collectionCenter && p.collectionCenter.isPublic
        ? { code: p.collectionCenter.code, name: p.collectionCenter.name, district: p.collectionCenter.district }
        : null,
    batch: p.primaryBatch ? { code: p.primaryBatch.code, stage: p.primaryBatch.stage, isPublic: p.primaryBatch.isPublic } : null,
    variants: p.variants
      .filter((v) => v.active)
      .map((v) => ({
        id: v.id,
        label: v.label,
        sku: v.sku,
        weightGrams: v.weightGrams,
        stock: v.stock,
        isDefault: v.isDefault,
        price: priceFor(v, ctx),
      })),
    status: p.status,
    hasDraft: Boolean(p.draft),
    isPreview,
  };
}

export const listPublishedProducts = cache(async (): Promise<ProductCard[]> => {
  const ctx = await getCurrencyContext();
  const rows = await db.query.products.findMany({
    where: eq(schema.products.status, "published"),
    with: withAll,
    orderBy: [asc(schema.products.name)],
  });
  return rows.map((r) => toCard(r, ctx)).filter((c) => c.variantCount > 0);
});

export const getFeaturedProducts = cache(async (limit = 6) => {
  const all = await listPublishedProducts();
  const featured = all.filter((p) => p.featured);
  return (featured.length ? featured : all).slice(0, limit);
});

export const listCategories = cache(async () =>
  db.query.categories.findMany({
    where: eq(schema.categories.active, true),
    orderBy: [asc(schema.categories.sortOrder), asc(schema.categories.name)],
  }),
);

export async function getPublishedProduct(slug: string): Promise<ProductDetail | null> {
  const ctx = await getCurrencyContext();
  const row = await fetchOne(and(eq(schema.products.slug, slug), eq(schema.products.status, "published"))!);
  return row ? toDetail(row, ctx) : null;
}

/**
 * Editor preview: renders the pending draft (if any) over the live record.
 * Only called after the caller has verified an editor session.
 */
export async function getProductPreview(slug: string): Promise<ProductDetail | null> {
  const ctx = await getCurrencyContext();
  const row = await fetchOne(eq(schema.products.slug, slug));
  if (!row) return null;
  if (!row.draft) return toDetail(row, ctx, true);
  const parsed = productInput.safeParse(row.draft);
  if (!parsed.success) return toDetail(row, ctx, true);
  return toDetail(await mergeDraft(row, parsed.data), ctx, true);
}

async function mergeDraft(row: ProductRow, d: ProductInput): Promise<ProductRow> {
  const category = d.categoryId ? (await db.query.categories.findFirst({ where: eq(schema.categories.id, d.categoryId) })) ?? null : null;
  const mediaRows = d.mediaIds.length
    ? await db
        .select({ id: schema.media.id, alt: schema.media.alt, width: schema.media.width, height: schema.media.height })
        .from(schema.media)
        .where(inArray(schema.media.id, d.mediaIds))
    : [];
  return {
    ...row,
    name: d.name,
    shortDescription: d.shortDescription,
    description: d.description,
    unit: d.unit,
    originCountry: d.originCountry,
    district: d.district,
    harvestDate: d.harvestDate,
    qualityGrade: d.qualityGrade,
    verificationStatus: d.verificationStatus,
    processingInfo: d.processingInfo,
    visual: d.visual,
    featured: d.featured,
    category,
    media: d.mediaIds
      .map((id, i) => ({ productId: row.id, mediaId: id, sortOrder: i, media: mediaRows.find((m) => m.id === id)! }))
      .filter((m) => m.media),
    variants: d.variants.map((v, i) => ({
      id: v.id ?? `draft-${i}`,
      productId: row.id,
      label: v.label,
      sku: v.sku,
      weightGrams: v.weightGrams ?? null,
      basePriceMinor: toMinor(v.basePriceNpr, "NPR"),
      stock: v.stock,
      isDefault: v.isDefault,
      sortOrder: i,
      active: v.active,
      createdAt: new Date(),
      updatedAt: new Date(),
      regionalPrices: v.regionalPrices.map((r) => ({ currency: r.currency, amountMinor: toMinor(r.amount, r.currency) })),
    })),
  };
}

export async function getRelatedProducts(product: ProductCard, limit = 4): Promise<ProductCard[]> {
  const all = await listPublishedProducts();
  const others = all.filter((p) => p.id !== product.id);
  const same = others.filter((p) => p.category?.slug === product.category?.slug);
  const rest = others.filter((p) => p.category?.slug !== product.category?.slug);
  return [...same, ...rest].slice(0, limit);
}

export interface CartLineInput {
  variantId: string;
  quantity: number;
}

export interface PricedCartLine {
  variantId: string;
  productSlug: string;
  productName: string;
  variantLabel: string;
  visual: string;
  imageId: string | null;
  quantity: number;
  stock: number;
  unitPrice: Money;
  lineMinor: number;
  lineBaseMinor: number;
  isDemo: boolean;
}

/** Price a cart server-side from the database. The client only ever sends variant IDs and quantities. */
export async function priceCart(lines: CartLineInput[]): Promise<{ lines: PricedCartLine[]; ctx: CurrencyContext }> {
  const ctx = await getCurrencyContext();
  const ids = [...new Set(lines.map((l) => l.variantId))].filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 50);
  if (!ids.length) return { lines: [], ctx };
  const variants = await db.query.productVariants.findMany({
    where: and(inArray(schema.productVariants.id, ids), eq(schema.productVariants.active, true)),
    with: {
      regionalPrices: { columns: { currency: true, amountMinor: true } },
      product: {
        columns: { slug: true, name: true, visual: true, status: true, isDemo: true },
        with: { media: { orderBy: [asc(schema.productMedia.sortOrder)], limit: 1, columns: { mediaId: true } } },
      },
    },
  });
  const out: PricedCartLine[] = [];
  for (const l of lines) {
    const v = variants.find((x) => x.id === l.variantId);
    if (!v || v.product.status !== "published") continue;
    const qty = Math.max(1, Math.min(99, Math.floor(l.quantity)));
    const unitPrice = priceFor(v, ctx);
    out.push({
      variantId: v.id,
      productSlug: v.product.slug,
      productName: v.product.name,
      variantLabel: v.label,
      visual: v.product.visual,
      imageId: v.product.media[0]?.mediaId ?? null,
      quantity: qty,
      stock: v.stock,
      unitPrice,
      lineMinor: unitPrice.amountMinor * qty,
      lineBaseMinor: v.basePriceMinor * qty,
      isDemo: v.product.isDemo,
    });
  }
  return { lines: out, ctx };
}

export async function productSlugsForSitemap() {
  return db
    .select({ slug: schema.products.slug, updatedAt: schema.products.updatedAt })
    .from(schema.products)
    .where(and(eq(schema.products.status, "published"), ne(schema.products.slug, "")));
}
