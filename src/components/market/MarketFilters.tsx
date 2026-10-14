"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import s from "./market.module.css";

interface Props {
  categories: { slug: string; name: string; nameNe: string | null; count: number }[];
  currency: string;
  total: number;
  shown: number;
}

export function MarketFilters({ categories, currency, total, shown }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  useEffect(() => {
    document.querySelector("[data-market-grid]")?.toggleAttribute("data-pending", pending);
  }, [pending]);

  const onSearch = (v: string) => {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => update({ q: v.trim() || null }), 260);
  };

  const cat = params.get("category") ?? "";
  const sort = params.get("sort") ?? "featured";
  const avail = params.get("avail") ?? "all";
  const activeCount = ["category", "min", "max", "avail"].filter((k) => params.get(k)).length;

  return (
    <div className={s.filters}>
      <div className={s.searchRow}>
        <label className={s.search}>
          <span className="sr-only">Search products</span>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search by product, district or batch code"
            className={s.searchInput}
          />
        </label>
        <button type="button" className={s.toggle} aria-expanded={open} aria-controls="market-filter-panel" onClick={() => setOpen((o) => !o)}>
          Filters{activeCount ? ` (${activeCount})` : ""}
        </button>
      </div>

      <div id="market-filter-panel" className={s.panel} data-open={open || undefined}>
        <fieldset className={s.group}>
          <legend>Category</legend>
          <div className={s.chips}>
            <button type="button" className={s.chip} aria-pressed={!cat} onClick={() => update({ category: null })}>
              All <span>{total}</span>
            </button>
            {categories.map((c) => (
              <button key={c.slug} type="button" className={s.chip} aria-pressed={cat === c.slug} onClick={() => update({ category: cat === c.slug ? null : c.slug })}>
                {c.name} <span>{c.count}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className={s.group}>
          <legend>Price in {currency}</legend>
          <div className={s.range}>
            <label>
              <span className="sr-only">Minimum price</span>
              <input
                className="input"
                inputMode="decimal"
                placeholder="Min"
                defaultValue={params.get("min") ?? ""}
                onBlur={(e) => update({ min: e.target.value.replace(/[^\d.]/g, "") || null })}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              />
            </label>
            <span aria-hidden="true">–</span>
            <label>
              <span className="sr-only">Maximum price</span>
              <input
                className="input"
                inputMode="decimal"
                placeholder="Max"
                defaultValue={params.get("max") ?? ""}
                onBlur={(e) => update({ max: e.target.value.replace(/[^\d.]/g, "") || null })}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className={s.group}>
          <legend>Availability</legend>
          <label className={s.check}>
            <input type="checkbox" checked={avail === "in"} onChange={(e) => update({ avail: e.target.checked ? "in" : null })} />
            In stock only
          </label>
        </fieldset>

        <label className={`${s.group} ${s.sort}`}>
          <span className={s.legend}>Sort</span>
          <select className="select" value={sort} onChange={(e) => update({ sort: e.target.value === "featured" ? null : e.target.value })}>
            <option value="featured">Featured first</option>
            <option value="price-asc">Price, low to high</option>
            <option value="price-desc">Price, high to low</option>
            <option value="newest">Newest</option>
            <option value="name">Name, A–Z</option>
          </select>
        </label>
      </div>

      <p className={s.count} aria-live="polite">
        {shown === total ? `${total} product${total === 1 ? "" : "s"}` : `${shown} of ${total} products`}
        {pending ? <span className={s.pendingLine} aria-hidden="true" /> : null}
      </p>
    </div>
  );
}
