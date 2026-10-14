import type { MetadataRoute } from "next";
import { productSlugsForSitemap } from "@/server/catalog/queries";
import { listPublicBatchCodes } from "@/server/trace/queries";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, batches] = await Promise.all([productSlugsForSitemap(), listPublicBatchCodes(500)]);
  const statics = ["/", "/market", "/trace", "/producers", "/company", "/contact", "/faq", "/legal/privacy", "/legal/terms", "/legal/shipping"];
  return [
    ...statics.map((p) => ({ url: absoluteUrl(p), changeFrequency: "weekly" as const, priority: p === "/" ? 1 : 0.6 })),
    ...products.map((p) => ({ url: absoluteUrl(`/products/${p.slug}`), lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...batches.map((b) => ({ url: absoluteUrl(`/trace/${b.code}`), changeFrequency: "monthly" as const, priority: 0.4 })),
  ];
}
