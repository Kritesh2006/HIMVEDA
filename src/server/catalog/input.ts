/** Product editor contract — validated identically on create, draft and publish. */
import { z } from "zod";
import { CURRENCY_CODES } from "@/lib/currency/config";

export const VISUALS = ["pod", "seed", "leaf", "grain", "root", "berry", "flower", "honey"] as const;
export const GRADES = ["A", "B", "C", "ungraded"] as const;
export const VERIFICATION = ["unverified", "pending", "verified"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((s) => (s && s.trim() ? s.trim() : null));
const optionalUuid = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .pipe(z.string().uuid().nullable());

export const regionalPriceInput = z.object({
  currency: z.enum(CURRENCY_CODES as unknown as [string, ...string[]]).refine((c) => c !== "NPR", "NPR is the base price"),
  amount: z.coerce.number().positive("Regional price must be positive").max(10_000_000),
});

export const variantInput = z.object({
  id: z.string().uuid().optional().nullable(),
  label: z.string().trim().min(1, "Variant label is required").max(60),
  sku: z
    .string()
    .trim()
    .min(2, "SKU is required")
    .max(40)
    .regex(/^[A-Za-z0-9-_.]+$/, "SKU may contain letters, numbers, - _ ."),
  weightGrams: z.coerce.number().int().positive().max(1_000_000).optional().nullable(),
  basePriceNpr: z.coerce.number().positive("Base price must be greater than zero").max(10_000_000),
  stock: z.coerce.number().int().min(0).max(1_000_000),
  isDefault: z.boolean().default(false),
  active: z.boolean().default(true),
  regionalPrices: z.array(regionalPriceInput).max(14).default([]),
});

export const productInput = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(120),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug: lowercase letters, numbers and hyphens"),
    categoryId: optionalUuid,
    shortDescription: z.string().trim().max(240).default(""),
    description: z.string().trim().max(8000).default(""),
    unit: z.string().trim().min(1).max(30).default("pack"),
    originCountry: z.string().trim().min(2).max(60).default("Nepal"),
    district: optionalText(60),
    producerId: optionalUuid,
    collectionCenterId: optionalUuid,
    primaryBatchId: optionalUuid,
    harvestDate: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v ? v : null))
      .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
    qualityGrade: z.enum(GRADES).default("ungraded"),
    verificationStatus: z.enum(VERIFICATION).default("unverified"),
    processingInfo: optionalText(1000),
    visual: z.enum(VISUALS).default("leaf"),
    featured: z.boolean().default(false),
    mediaIds: z.array(z.string().uuid()).max(8).default([]),
    variants: z.array(variantInput).min(1, "Add at least one variant with a price").max(12),
  })
  .superRefine((p, ctx) => {
    const skus = new Set<string>();
    p.variants.forEach((v, i) => {
      const k = v.sku.toUpperCase();
      if (skus.has(k)) ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: "Duplicate SKU" });
      skus.add(k);
      const cur = new Set<string>();
      v.regionalPrices.forEach((r, j) => {
        if (cur.has(r.currency))
          ctx.addIssue({ code: "custom", path: ["variants", i, "regionalPrices", j, "currency"], message: "Duplicate currency" });
        cur.add(r.currency);
      });
    });
  });

export type ProductInput = z.infer<typeof productInput>;
export type ProductInputRaw = z.input<typeof productInput>;
