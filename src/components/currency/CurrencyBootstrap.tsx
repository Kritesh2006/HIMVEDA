"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { STORAGE_CURRENCY, type DetectionSource } from "@/lib/currency/config";
import { setCurrencyPreference, setEstimatedCountryFromTimezone } from "@/app/actions/currency";

/**
 * Runs once per page load:
 * 1. Restores a manual choice saved in localStorage if its cookie was cleared.
 * 2. If the server had no location signal at all, tries the time-zone estimate.
 */
export function CurrencyBootstrap({ source, hasGeo }: { source: DetectionSource; hasGeo: boolean }) {
  const router = useRouter();
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_CURRENCY);
    } catch {
      /* storage unavailable */
    }
    if (saved && source !== "manual") {
      setCurrencyPreference(saved).then((r) => r.ok && router.refresh());
      return;
    }
    if (!hasGeo && source === "default") {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setEstimatedCountryFromTimezone(tz).then((r) => r.ok && r.country !== "NP" && router.refresh());
    }
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
