"use server";

import { cookies } from "next/headers";
import {
  COOKIE_CURRENCY,
  COOKIE_GEO,
  TIMEZONE_COUNTRY,
  isCurrencyCode,
  isValidCountryCode,
} from "@/lib/currency/config";

const YEAR = 60 * 60 * 24 * 365;

/** Manual currency choice. `null` returns to automatic detection. */
export async function setCurrencyPreference(code: string | null) {
  const jar = await cookies();
  if (code === null) {
    jar.delete(COOKIE_CURRENCY);
    return { ok: true as const };
  }
  if (!isCurrencyCode(code)) return { ok: false as const };
  jar.set(COOKIE_CURRENCY, code, { path: "/", maxAge: YEAR, sameSite: "lax" });
  return { ok: true as const };
}

/**
 * Weak fallback when the platform supplied no geolocation: the browser's IANA
 * time zone (never its language). Ignored if a stronger signal already exists.
 */
export async function setEstimatedCountryFromTimezone(timeZone: string) {
  const jar = await cookies();
  const existing = jar.get(COOKIE_GEO)?.value;
  if (existing?.endsWith(":edge")) return { ok: false as const };
  const country = TIMEZONE_COUNTRY[timeZone];
  if (!isValidCountryCode(country)) return { ok: false as const };
  jar.set(COOKIE_GEO, `${country}:timezone`, { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" });
  return { ok: true as const, country };
}
