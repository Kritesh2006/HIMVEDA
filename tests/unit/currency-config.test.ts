import { describe, expect, it } from "vitest";
import { currencyForCountry, formatMoney, formatParts, isValidCountryCode, minorUnitDigits, toMinor } from "@/lib/currency/config";

describe("country → currency", () => {
  it.each([
    ["NP", "NPR"],
    ["US", "USD"],
    ["GB", "GBP"],
    ["IN", "INR"],
    ["CA", "CAD"],
    ["AU", "AUD"],
    ["DE", "EUR"],
    ["FR", "EUR"],
    ["PL", "EUR"],
    ["AE", "AED"],
    ["JP", "JPY"],
  ])("%s → %s", (country, currency) => expect(currencyForCountry(country)).toBe(currency));

  it("falls back to USD for a detected but unmapped country", () => expect(currencyForCountry("BR")).toBe("USD"));
  it("rejects unknown / anonymised country codes", () => {
    expect(isValidCountryCode("XX")).toBe(false);
    expect(isValidCountryCode("T1")).toBe(false);
    expect(isValidCountryCode("np")).toBe(false);
    expect(isValidCountryCode("NP")).toBe(true);
  });
});

describe("formatting", () => {
  it("formats NPR with रू and South-Asian grouping, whole rupees", () => {
    expect(formatMoney(150_000, "NPR")).toBe("रू 1,500");
    expect(formatMoney(12_345_600, "NPR")).toBe("रू 1,23,456");
  });
  it("shows paisa only when present", () => expect(formatMoney(150_050, "NPR")).toBe("रू 1,500.50"));
  it("formats foreign currencies via Intl and marks approximations", () => {
    expect(formatMoney(1071, "USD")).toBe("$10.71");
    expect(formatMoney(1071, "USD", { approx: true })).toBe("≈ $10.71");
    expect(formatMoney(1613, "JPY")).toBe("¥1,613");
  });
  it("knows minor units per currency", () => {
    expect(minorUnitDigits("NPR")).toBe(2);
    expect(minorUnitDigits("JPY")).toBe(0);
    expect(minorUnitDigits("KWD")).toBe(3);
    expect(toMinor(14.99, "USD")).toBe(1499);
  });
  it("splits a price for animation", () => expect(formatParts(1071, "USD")).toEqual({ prefix: "$", number: "10.71", suffix: "" }));
});
