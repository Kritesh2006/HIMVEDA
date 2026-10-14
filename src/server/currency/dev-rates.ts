import type { CurrencyCode } from "@/lib/currency/config";

/**
 * DEVELOPMENT EXCHANGE RATES — NOT FOR REAL TRANSACTIONS.
 *
 * Expressed as NPR per 1 unit of foreign currency, rounded reference levels.
 * They exist so the site renders sensibly without a live FX provider.
 * Prices converted with these rates are always labelled "≈" in the UI and
 * the rate source is shown as "development rates".
 *
 * - INR: Nepal's official peg (1 INR = 1.6 NPR). This one is structural.
 * - USD-pegged Gulf currencies (AED 3.6725, QAR 3.64, SAR 3.75) derived from USD.
 * - All others: approximate reference levels; replace via FX_PROVIDER in production.
 */
export const DEV_NPR_PER_UNIT: Record<Exclude<CurrencyCode, "NPR">, number> = {
  INR: 1.6,
  USD: 140,
  GBP: 186,
  EUR: 162,
  CAD: 101,
  AUD: 91,
  JPY: 0.93,
  KRW: 0.1,
  AED: 38.12,
  QAR: 38.46,
  SAR: 37.33,
  KWD: 457,
  MYR: 33,
};

export const DEV_RATE_SOURCE = "dev-static";
