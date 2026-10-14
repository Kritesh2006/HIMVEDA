import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import {
  BASE_CURRENCY,
  COOKIE_CURRENCY,
  COOKIE_GEO,
  currencyForCountry,
  isCurrencyCode,
  isValidCountryCode,
  type CurrencyCode,
  type DetectionSource,
} from "@/lib/currency/config";
import { getFxProvider, type RateTable } from "./provider";
import { resolvePrice, type Money, type PriceInput, type Rounding } from "./pricing";
import { DEV_RATE_SOURCE } from "./dev-rates";

export interface CurrencyContext {
  currency: CurrencyCode;
  country: string | null;
  source: DetectionSource;
  rate: number | undefined;
  rateSource: string | null;
  rateFetchedAt: string | null;
  rounding: Rounding;
}

interface RateSnapshot {
  rates: RateTable;
  meta: Partial<Record<CurrencyCode, { source: string; fetchedAt: string }>>;
  rounding: Partial<Record<CurrencyCode, Rounding>>;
}

/** Load rates once per request. If the table is empty, bootstrap it from the configured provider. */
export const loadRates = cache(async (): Promise<RateSnapshot> => {
  let rows = await db.select().from(schema.currencyRates);
  if (rows.length === 0) {
    await refreshRates();
    rows = await db.select().from(schema.currencyRates);
  }
  const rules = await db
    .select()
    .from(schema.pricingRules)
    .where(eq(schema.pricingRules.kind, "display_rounding"));
  const snap: RateSnapshot = { rates: { NPR: 1 }, meta: {}, rounding: {} };
  for (const r of rows) {
    if (!isCurrencyCode(r.currency)) continue;
    snap.rates[r.currency] = Number(r.ratePerNpr);
    snap.meta[r.currency] = { source: r.source, fetchedAt: r.fetchedAt.toISOString() };
  }
  for (const rule of rules) {
    if (rule.active && rule.currency && isCurrencyCode(rule.currency)) snap.rounding[rule.currency] = rule.rounding;
  }
  return snap;
});

/** Pull fresh rates from the provider and upsert them. Falls back to dev rates on failure. */
export async function refreshRates(): Promise<{ source: string; count: number; error?: string }> {
  const provider = getFxProvider();
  let rates: RateTable;
  let source = provider.name;
  let error: string | undefined;
  try {
    rates = await provider.fetchRates();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    const { DevStaticProvider } = await import("./provider");
    rates = await new DevStaticProvider().fetchRates();
    source = DEV_RATE_SOURCE;
  }
  const now = new Date();
  let count = 0;
  for (const [currency, rate] of Object.entries(rates)) {
    if (!rate || currency === BASE_CURRENCY) continue;
    await db
      .insert(schema.currencyRates)
      .values({ currency, ratePerNpr: rate.toFixed(10), source, fetchedAt: now })
      .onConflictDoUpdate({
        target: schema.currencyRates.currency,
        set: { ratePerNpr: rate.toFixed(10), source, fetchedAt: now },
      });
    count++;
  }
  return { source, count, error };
}

/**
 * Determine the visitor's display currency.
 * Order: manual choice → edge geolocation → (weak) time-zone estimate → NPR default.
 * Browser language is never used as a location signal.
 */
export const getCurrencyContext = cache(async (): Promise<CurrencyContext> => {
  const jar = await cookies();
  const snap = await loadRates();

  let currency: CurrencyCode = BASE_CURRENCY;
  let country: string | null = null;
  let source: DetectionSource = "default";

  const geo = jar.get(COOKIE_GEO)?.value;
  if (geo) {
    const [c, s] = geo.split(":");
    if (isValidCountryCode(c) && (s === "edge" || s === "timezone")) {
      country = c;
      source = s;
      currency = currencyForCountry(c);
    }
  }
  if (!country) {
    // Middleware normally sets the cookie; read the header directly on the first request.
    const h = await headers();
    const edge = h.get("x-himveda-country");
    if (isValidCountryCode(edge)) {
      country = edge;
      source = "edge";
      currency = currencyForCountry(edge);
    }
  }
  const manual = jar.get(COOKIE_CURRENCY)?.value;
  if (isCurrencyCode(manual)) {
    currency = manual;
    source = "manual";
  }
  if (currency !== BASE_CURRENCY && !snap.rates[currency]) currency = BASE_CURRENCY;

  return {
    currency,
    country,
    source,
    rate: snap.rates[currency],
    rateSource: snap.meta[currency]?.source ?? (currency === BASE_CURRENCY ? "base" : null),
    rateFetchedAt: snap.meta[currency]?.fetchedAt ?? null,
    rounding: snap.rounding[currency] ?? (currency === "NPR" ? "whole" : "none"),
  };
});

export function priceFor(input: PriceInput, ctx: CurrencyContext): Money {
  return resolvePrice(input, ctx.currency, ctx.rate, ctx.rounding);
}

export function isDevRates(ctx: CurrencyContext) {
  return ctx.rateSource === DEV_RATE_SOURCE;
}
