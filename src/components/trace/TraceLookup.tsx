"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import s from "./TraceLookup.module.css";

const PATTERN = /^HIM-\d{2}-[A-Z]{3}-\d{5}$/;

/** Batch code entry. Normalises spacing/case and validates the format before navigating. */
export function TraceLookup({ placeholder, initial = "", tone }: { placeholder: string; initial?: string; tone?: "forest" }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const id = useId();

  const normalise = (v: string) => {
    const raw = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const m = raw.match(/^HIM(\d{2})([A-Z]{3})(\d{1,5})$/);
    return m ? `HIM-${m[1]}-${m[2]}-${m[3]!.padStart(5, "0")}` : v.trim().toUpperCase();
  };

  return (
    <form
      className={s.form}
      data-tone={tone}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const code = normalise(value);
        if (!PATTERN.test(code)) {
          setError(`Batch codes look like ${placeholder} — HIM, the year, a collection-centre code and a number.`);
          return;
        }
        setError(null);
        router.push(`/trace/${code}`);
      }}
    >
      <label htmlFor={id} className={s.label}>
        Batch code
      </label>
      <div className={s.row}>
        <input
          id={id}
          className={s.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-err` : undefined}
          inputMode="text"
        />
        <button type="submit" className="btn" data-magnetic>
          Trace
        </button>
      </div>
      {error ? (
        <p id={`${id}-err`} className="error-text" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
