import { describe, expect, it } from "vitest";
import { convertFromNpr, resolvePrice, roundMajor } from "@/server/currency/pricing";

const USD = 1 / 140; // dev reference rate

describe("resolvePrice", () => {
  it("returns the canonical NPR price untouched for NPR visitors", () => {
    const m = resolvePrice({ basePriceMinor: 150_000 }, "NPR", 1);
    expect(m).toEqual({ amountMinor: 150_000, currency: "NPR", approximate: false, override: false, baseMinor: 150_000 });
  });

  it("converts from NPR and marks the result approximate", () => {
    const m = resolvePrice({ basePriceMinor: 150_000 }, "USD", USD);
    expect(m.currency).toBe("USD");
    expect(m.amountMinor).toBe(1071); // NPR 1,500 / 140 = $10.71
    expect(m.approximate).toBe(true);
    expect(m.baseMinor).toBe(150_000);
  });

  it("prefers an intentional regional price over conversion", () => {
    const m = resolvePrice({ basePriceMinor: 150_000, regionalPrices: [{ currency: "USD", amountMinor: 1499 }] }, "USD", USD);
    expect(m).toMatchObject({ amountMinor: 1499, override: true, approximate: false });
  });

  it("only applies an override to its own currency", () => {
    const m = resolvePrice({ basePriceMinor: 150_000, regionalPrices: [{ currency: "GBP", amountMinor: 1199 }] }, "USD", USD);
    expect(m.override).toBe(false);
  });

  it("fails safe to NPR when no rate is available rather than guessing", () => {
    const m = resolvePrice({ basePriceMinor: 150_000 }, "EUR", undefined);
    expect(m).toMatchObject({ currency: "NPR", amountMinor: 150_000, approximate: false });
  });

  it("respects zero-decimal and three-decimal currencies", () => {
    expect(convertFromNpr(150_000, "JPY", 1 / 0.93)).toBe(1613); // ¥1,613, no minor unit
    expect(convertFromNpr(150_000, "KWD", 1 / 457)).toBe(3282); // 3.282 KWD
  });
});

describe("rounding", () => {
  it("supports whole, half and .99 endings", () => {
    expect(roundMajor(10.71, "whole", 2)).toBe(11);
    expect(roundMajor(10.71, "half", 2)).toBe(10.5);
    expect(roundMajor(10.21, "charm_99", 2)).toBe(10.99);
    expect(roundMajor(10.71, "none", 2)).toBe(10.71);
  });
  it("applies rounding during conversion", () => {
    expect(convertFromNpr(150_000, "USD", USD, "charm_99")).toBe(1099);
  });
});
