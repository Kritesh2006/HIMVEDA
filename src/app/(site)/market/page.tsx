import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { listCategories, listPublishedProducts, type ProductCard as Card } from "@/server/catalog/queries";
import { getCurrencyContext } from "@/server/currency/service";
import { getContent } from "@/server/content/service";
import { minorUnitDigits } from "@/lib/currency/config";
import { ProductCard } from "@/components/product/ProductCard";
import { MarketFilters } from "@/components/market/MarketFilters";
import s from "@/components/market/market.module.css";

export const metadata: Metadata = {
  title: "Market",
  description: "Nepali produce sold batch by batch, each with its origin, inspection and processing on record.",
  alternates: { canonical: "/market" },
};

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function applyFilters(all: Card[], sp: Record<string, string>, digits: number) {
  const q = sp.q?.toLowerCase().trim();
  const min = sp.min ? Number(sp.min) * 10 ** digits : null;
  const max = sp.max ? Number(sp.max) * 10 ** digits : null;
  let out = all.filter((p) => {
    if (sp.category && p.category?.slug !== sp.category) return false;
    if (sp.avail === "in" && !p.inStock) return false;
    const price = p.fromPrice?.amountMinor ?? 0;
    if (min !== null && Number.isFinite(min) && price < min) return false;
    if (max !== null && Number.isFinite(max) && price > max) return false;
    if (q) {
      const hay = [p.name, p.shortDescription, p.district, p.category?.name, p.batchCode].join(" ").toLowerCase();
      if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  const price = (p: Card) => p.fromPrice?.amountMinor ?? 0;
  switch (sp.sort) {
    case "price-asc":
      out = out.sort((a, b) => price(a) - price(b));
      break;
    case "price-desc":
      out = out.sort((a, b) => price(b) - price(a));
      break;
    case "newest":
      out = out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case "name":
      out = out.sort((a, b) => a.name.localeCompare(b.name));
      break;
    default:
      out = out.sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.inStock) - Number(a.inStock) || a.name.localeCompare(b.name));
  }
  return out;
}

export default async function MarketPage({ searchParams }: { searchParams: SP }) {
  const raw = await searchParams;
  const sp = Object.fromEntries(["q", "category", "min", "max", "sort", "avail"].map((k) => [k, one(raw[k])]));
  const [all, cats, ctx, c] = await Promise.all([listPublishedProducts(), listCategories(), getCurrencyContext(), getContent()]);
  const results = applyFilters(all, sp, minorUnitDigits(ctx.currency));
  const categories = cats
    .map((cat) => ({ slug: cat.slug, name: cat.name, nameNe: cat.nameNe, count: all.filter((p) => p.category?.slug === cat.slug).length }))
    .filter((cat) => cat.count > 0);
  const key = JSON.stringify(sp);

  return (
    <div className={`wrap ${s.page}`}>
      <header className={s.head}>
        <h1 className="display">Market</h1>
        <p className="lede">
          Produce from Nepal, sold batch by batch. Every listing links to the record of where it came from and what was checked.
        </p>
      </header>

      <Suspense fallback={<div className={s.filters} />}>
        <MarketFilters categories={categories} currency={ctx.currency} total={all.length} shown={results.length} />
      </Suspense>

      {results.length ? (
        <ul role="list" className={s.grid} data-market-grid key={key}>
          {results.map((p, i) => (
            <li key={p.id} style={{ ["--i" as string]: Math.min(i, 8) }}>
              <ProductCard product={p} showSample={c["settings.demoMode"]} priority={i < 4} />
            </li>
          ))}
        </ul>
      ) : (
        <div className={s.empty} data-market-grid>
          <svg viewBox="0 0 120 60" aria-hidden="true" className={s.emptyArt}>
            <path d="M4 52 C 30 50, 40 18, 60 16 S 96 44, 116 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 5" />
            <circle cx="60" cy="16" r="4" fill="var(--marigold)" />
          </svg>
          {all.length ? (
            <>
              <h2 className="h2">Nothing matches {sp.q ? `“${sp.q}”` : "those filters"}.</h2>
              <p className="muted">Try a different word, or clear the filters to see every product.</p>
              <Link href="/market" className="btn">
                Clear filters
              </Link>
            </>
          ) : (
            <>
              <h2 className="h2">The market opens with the first published batch.</h2>
              <p className="muted">Products appear here as soon as they are published in HIMVEDA Studio.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
