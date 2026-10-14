"use client";

import { useEffect, useRef, useState } from "react";
import { formatMoney, minorUnitDigits } from "@/lib/currency/config";

interface Props {
  minor: number;
  currency: string;
  approx?: boolean;
  className?: string;
  /** e.g. "from" */
  prefix?: string;
}

const reduce = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Displays a server-resolved price. When the value or currency changes (e.g. the
 * visitor switches currency) the figure counts to its new value instead of jumping.
 * Purely presentational: no rates, no conversion logic lives here.
 */
export function Price({ minor, currency, approx, className, prefix }: Props) {
  const [shown, setShown] = useState({ minor, currency });
  const prev = useRef({ minor, currency });
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const from = prev.current;
    prev.current = { minor, currency };
    if (from.minor === minor && from.currency === currency) return;
    if (reduce()) {
      setShown({ minor, currency });
      return;
    }
    // Animate in the target currency's units, starting from a proportional value
    const digitsTo = minorUnitDigits(currency);
    const start = from.currency === currency ? from.minor : Math.round(minor * 0.6);
    const t0 = performance.now();
    const dur = 520;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      const v = start + (minor - start) * e;
      const unit = 10 ** digitsTo;
      const rounded = k < 1 ? Math.round(v / unit) * unit : minor;
      setShown({ minor: k < 1 ? rounded : minor, currency });
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [minor, currency]);

  const text = formatMoney(shown.minor, shown.currency, { approx });
  const final = formatMoney(minor, currency, { approx });
  return (
    <span className={className} data-price>
      {prefix ? <span data-price-prefix>{prefix} </span> : null}
      <span aria-hidden="true" className="num">
        {text}
      </span>
      <span className="sr-only">{approx ? `approximately ${final.replace("≈ ", "")}` : final}</span>
    </span>
  );
}
