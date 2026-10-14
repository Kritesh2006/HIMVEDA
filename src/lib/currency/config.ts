/**
 * Pure currency configuration shared by server and client.
 * Contains NO exchange rates — rates live only in the server currency service.
 */

export const BASE_CURRENCY = "NPR" as const;

export type CurrencyCode =
  | "NPR"
  | "USD"
  | "GBP"
  | "EUR"
  | "INR"
  | "CAD"
  | "AUD"
  | "JPY"
  | "KRW"
  | "AED"
  | "QAR"
  | "SAR"
  | "KWD"
  | "MYR";

export interface CurrencyMeta {
  code: CurrencyCode;
  name: string;
  /** Short label for the selector, e.g. "Nepal · NPR" */
  region: string;
}

/**
 * Supported display currencies. Beyond the core markets, the list deliberately
 * includes the Gulf states, Malaysia, Japan and Korea — the largest Nepali
 * diaspora corridors, and therefore likely international buyers.
 */
export const CURRENCIES: readonly CurrencyMeta[] = [
  { code: "NPR", name: "Nepalese rupee", region: "Nepal" },
  { code: "USD", name: "US dollar", region: "United States" },
  { code: "GBP", name: "Pound sterling", region: "United Kingdom" },
  { code: "EUR", name: "Euro", region: "European Union" },
  { code: "INR", name: "Indian rupee", region: "India" },
  { code: "CAD", name: "Canadian dollar", region: "Canada" },
  { code: "AUD", name: "Australian dollar", region: "Australia" },
  { code: "JPY", name: "Japanese yen", region: "Japan" },
  { code: "KRW", name: "South Korean won", region: "South Korea" },
  { code: "AED", name: "UAE dirham", region: "United Arab Emirates" },
  { code: "QAR", name: "Qatari riyal", region: "Qatar" },
  { code: "SAR", name: "Saudi riyal", region: "Saudi Arabia" },
  { code: "KWD", name: "Kuwaiti dinar", region: "Kuwait" },
  { code: "MYR", name: "Malaysian ringgit", region: "Malaysia" },
] as const;

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as readonly CurrencyCode[];

export function isCurrencyCode(v: unknown): v is CurrencyCode {
  return typeof v === "string" && (CURRENCY_CODES as readonly string[]).includes(v);
}

/** EU member states → EUR (non-euro EU members also default to EUR for display). */
const EU = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT",
  "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
];

const COUNTRY_CURRENCY: Record<string, CurrencyCode> = {
  NP: "NPR",
  US: "USD",
  GB: "GBP",
  IN: "INR",
  CA: "CAD",
  AU: "AUD",
  JP: "JPY",
  KR: "KRW",
  AE: "AED",
  QA: "QAR",
  SA: "SAR",
  KW: "KWD",
  MY: "MYR",
  ...Object.fromEntries(EU.map((c) => [c, "EUR" as const])),
};

/**
 * Country → display currency.
 * A detected-but-unmapped country falls back to USD (the international default).
 * No country at all falls back to NPR — the caller handles that case.
 */
export function currencyForCountry(country: string): CurrencyCode {
  return COUNTRY_CURRENCY[country.toUpperCase()] ?? "USD";
}

export function isValidCountryCode(v: unknown): v is string {
  return typeof v === "string" && /^[A-Z]{2}$/.test(v) && v !== "XX" && v !== "T1";
}

/** Minor-unit exponent per ISO-4217 (from Intl, so JPY → 0, KWD → 3). */
export function minorUnitDigits(currency: string): number {
  if (currency === "NPR") return 2;
  return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

export function toMinor(major: number, currency: string): number {
  return Math.round(major * 10 ** minorUnitDigits(currency));
}

export function toMajor(minor: number, currency: string): number {
  return minor / 10 ** minorUnitDigits(currency);
}

/**
 * Format a money amount for display.
 * NPR uses the रू symbol with South-Asian digit grouping (1,00,000), whole rupees.
 */
export function formatMoney(minor: number, currency: string, opts: { approx?: boolean } = {}): string {
  const major = toMajor(minor, currency);
  let out: string;
  if (currency === "NPR") {
    const showPaisa = Math.round(major * 100) % 100 !== 0;
    out =
      "रू " +
      new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: showPaisa ? 2 : 0,
        maximumFractionDigits: showPaisa ? 2 : 0,
      }).format(major);
  } else {
    out = new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      currencyDisplay: "symbol",
    }).format(major);
  }
  return opts.approx ? `≈ ${out}` : out;
}

/** Split a formatted price so the number can be animated independently of the symbol. */
export function formatParts(minor: number, currency: string): { prefix: string; number: string; suffix: string } {
  const full = formatMoney(minor, currency);
  const m = full.match(/^(\D*?)([\d.,\s]+\d)(\D*)$/);
  if (!m) return { prefix: "", number: full, suffix: "" };
  return { prefix: m[1] ?? "", number: m[2] ?? "", suffix: m[3] ?? "" };
}

/** Weak, client-side fallback only: IANA time zone → probable country. Never used when a stronger signal exists. */
export const TIMEZONE_COUNTRY: Record<string, string> = {
  "Asia/Kathmandu": "NP",
  "Asia/Katmandu": "NP",
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Europe/London": "GB",
  "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR",
  "Asia/Dubai": "AE",
  "Asia/Qatar": "QA",
  "Asia/Riyadh": "SA",
  "Asia/Kuwait": "KW",
  "Asia/Kuala_Lumpur": "MY",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Edmonton": "CA",
  "America/Winnipeg": "CA",
  "America/Halifax": "CA",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Phoenix": "US",
  "America/Los_Angeles": "US",
  "America/Anchorage": "US",
  "Pacific/Honolulu": "US",
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Australia/Brisbane": "AU",
  "Australia/Perth": "AU",
  "Australia/Adelaide": "AU",
  "Europe/Berlin": "DE",
  "Europe/Paris": "FR",
  "Europe/Madrid": "ES",
  "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE",
  "Europe/Vienna": "AT",
  "Europe/Dublin": "IE",
  "Europe/Lisbon": "PT",
  "Europe/Helsinki": "FI",
  "Europe/Athens": "GR",
  "Europe/Warsaw": "PL",
};

export type DetectionSource = "manual" | "edge" | "timezone" | "default";

export const COOKIE_CURRENCY = "hv_currency"; // manual override (persisted)
export const COOKIE_GEO = "hv_geo"; // "US:edge" | "NP:timezone"
export const STORAGE_CURRENCY = "himveda.currency";
