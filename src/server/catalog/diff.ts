/** Human-readable change descriptions for the audit trail. Pure — unit tested. */
import { formatMoney, toMinor } from "@/lib/currency/config";
import type { ProductInput } from "./input";


const FIELD_LABELS: Partial<Record<keyof ProductInput, string>> = {
  name: "name",
  slug: "URL slug",
  categoryId: "category",
  shortDescription: "short description",
  description: "description",
  unit: "unit",
  originCountry: "origin country",
  district: "district",
  producerId: "producer",
  collectionCenterId: "collection centre",
  primaryBatchId: "batch",
  harvestDate: "harvest date",
  qualityGrade: "quality grade",
  verificationStatus: "verification status",
  processingInfo: "processing information",
  visual: "illustration",
  featured: "featured flag",
  mediaIds: "images",
};

export function describeChanges(before: ProductInput | null, after: ProductInput): string[] {
  const out: string[] = [];
  if (!before) return out;
  for (const [k, label] of Object.entries(FIELD_LABELS) as [keyof ProductInput, string][]) {
    if (JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null)) {
      const b = before[k];
      const a = after[k];
      out.push(
        typeof a === "string" && typeof b === "string" && a.length < 50 && b.length < 50 ? `${label}: “${b}” → “${a}”` : `${label} updated`,
      );
    }
  }
  const prev = new Map(before.variants.map((v) => [v.id ?? v.sku, v]));
  for (const v of after.variants) {
    const old = (v.id && prev.get(v.id)) || prev.get(v.sku);
    if (!old) {
      out.push(`added variant ${v.label} at ${formatMoney(toMinor(v.basePriceNpr, "NPR"), "NPR").replace("रू", "NPR")}`);
      continue;
    }
    if (old.basePriceNpr !== v.basePriceNpr) {
      out.push(
        `${v.label} base price ${formatMoney(toMinor(old.basePriceNpr, "NPR"), "NPR").replace("रू", "NPR")} → ${formatMoney(
          toMinor(v.basePriceNpr, "NPR"),
          "NPR",
        ).replace("रू", "NPR")}`,
      );
    }
    if (old.stock !== v.stock) out.push(`${v.label} stock ${old.stock} → ${v.stock}`);
    if (old.label !== v.label) out.push(`variant “${old.label}” renamed “${v.label}”`);
    if (JSON.stringify(old.regionalPrices) !== JSON.stringify(v.regionalPrices)) out.push(`${v.label} regional prices updated`);
    if (old.active !== v.active) out.push(`${v.label} ${v.active ? "activated" : "deactivated"}`);
  }
  const nextKeys = new Set(after.variants.map((v) => v.id ?? v.sku));
  for (const [key, v] of prev) if (!nextKeys.has(key) && !after.variants.some((x) => x.sku === v.sku)) out.push(`removed variant ${v.label}`);
  return out;
}

