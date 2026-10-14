"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES, STORAGE_CURRENCY, type CurrencyCode, type DetectionSource } from "@/lib/currency/config";
import { setCurrencyPreference } from "@/app/actions/currency";
import styles from "./CurrencySelector.module.css";

interface Props {
  currency: CurrencyCode;
  source: DetectionSource;
  country: string | null;
  devRates: boolean;
  placement?: "down" | "up";
}

const SOURCE_TEXT: Record<DetectionSource, string> = {
  manual: "Chosen by you",
  edge: "Based on your location",
  timezone: "Estimated from your time zone",
  default: "Default currency",
};

export function CurrencySelector({ currency, source, country, devRates, placement = "down" }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    root.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (code: CurrencyCode | null) => {
    try {
      if (code) window.localStorage.setItem(STORAGE_CURRENCY, code);
      else window.localStorage.removeItem(STORAGE_CURRENCY);
    } catch {
      /* storage unavailable: the cookie still persists the choice */
    }
    start(async () => {
      await setCurrencyPreference(code);
      router.refresh();
    });
  };

  return (
    <div className={styles.root} ref={root}>
      <button
        ref={btn}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        data-pending={pending || undefined}
      >
        <span className={styles.code}>{currency}</span>
        <span className="sr-only">Change currency. Prices currently shown in {currency}.</span>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>
      {open && (
        <div className={styles.panel} id={panelId} role="dialog" aria-label="Country and currency" data-placement={placement}>
          <p className={styles.status}>
            <strong>{currency}</strong> · {SOURCE_TEXT[source]}
            {country && source !== "manual" ? ` (${country})` : ""}
          </p>
          <fieldset className={styles.list} disabled={pending}>
            <legend className="sr-only">Currency</legend>
            <label className={styles.option}>
              <input type="radio" name="currency" checked={source !== "manual"} onChange={() => choose(null)} />
              <span>Automatic</span>
              <span className={styles.region}>Use my location</span>
            </label>
            {CURRENCIES.map((c) => (
              <label key={c.code} className={styles.option} data-active={c.code === currency || undefined}>
                <input
                  type="radio"
                  name="currency"
                  value={c.code}
                  checked={source === "manual" && c.code === currency}
                  onChange={() => choose(c.code)}
                />
                <span className={styles.optCode}>{c.code}</span>
                <span className={styles.region}>{c.region}</span>
              </label>
            ))}
          </fieldset>
          <p className={styles.note}>
            Prices are set in Nepalese rupees. Other currencies are conversions, marked “≈”, unless a price was set for that
            currency.{devRates ? " Conversions currently use development reference rates." : ""}
          </p>
        </div>
      )}
    </div>
  );
}
