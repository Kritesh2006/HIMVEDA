/**
 * Pure price resolution — no I/O, fully unit-tested.
 * Precedence: manual regional override → converted base price → base price.
 */
import { minorUnitDigits, type CurrencyCode } from "@/lib/currency/config";

export type Rounding = "none" | "whole" | "half" | "charm_99";

export interface Money {
  amountMinor: number;
  currency: CurrencyCode;
  /** true when the amount is a conversion rather than an owner-set price */
  approximate: boolean;
  /** true when an intentional regional price was used */
  override: boolean;
  /** canonical NPR amount, always present */
  baseMinor: number;
}

export interface PriceInput {
  basePriceMinor: number; // NPR paisa
  regionalPrices?: { currency: string; amountMinor: number }[];
}

export function roundMajor(value: number, rounding: Rounding, digits: number): number {
  switch (rounding) {
    case "whole":
      return Math.round(value);
    case "half":
      return Math.round(value * 2) / 2;
    case "charm_99": {
      if (digits === 0) return Math.max(1, Math.ceil(value));
      const up = Math.ceil(value);
      return Math.max(0.99, up - 0.01);
    }
    default:
      return Number(value.toFixed(digits));
  }
}

export function convertFromNpr(
  nprMinor: number,
  currency: CurrencyCode,
  ratePerNpr: number,
  rounding: Rounding = "none",
): number {
  if (currency === "NPR") return nprMinor;
  const digits = minorUnitDigits(currency);
  const major = (nprMinor / 100) * ratePerNpr;
  const rounded = roundMajor(major, rounding, digits);
  return Math.round(rounded * 10 ** digits);
}

export function resolvePrice(
  input: PriceInput,
  currency: CurrencyCode,
  ratePerNpr: number | undefined,
  rounding: Rounding = "none",
): Money {
  const base = input.basePriceMinor;
  if (currency === "NPR") {
    return { amountMinor: base, currency, approximate: false, override: false, baseMinor: base };
  }
  const regional = input.regionalPrices?.find((r) => r.currency === currency);
  if (regional) {
    return { amountMinor: regional.amountMinor, currency, approximate: false, override: true, baseMinor: base };
  }
  if (!ratePerNpr || !Number.isFinite(ratePerNpr) || ratePerNpr <= 0) {
    // No rate available: fail safe to the canonical NPR price rather than guessing.
    return { amountMinor: base, currency: "NPR", approximate: false, override: false, baseMinor: base };
  }
  return {
    amountMinor: convertFromNpr(base, currency, ratePerNpr, rounding),
    currency,
    approximate: true,
    override: false,
    baseMinor: base,
  };
}
