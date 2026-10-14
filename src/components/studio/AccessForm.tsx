"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { enterStudio, type AccessState } from "@/app/actions/access";
import { Mark } from "@/components/brand/Logo";
import s from "./access.module.css";

const LENGTH = 4;

/**
 * Four-digit access screen. Digits are only ever compared on the server, after
 * the whole code is submitted — the UI never knows whether any digit is right.
 */
export function AccessForm() {
  const [state, action, pending] = useActionState<AccessState, FormData>(enterStudio, { status: "idle" });
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const form = useRef<HTMLFormElement>(null);
  const [shake, setShake] = useState(0);

  useEffect(() => {
    if (state.status === "invalid" || state.status === "locked") {
      setDigits(Array(LENGTH).fill(""));
      setShake((n) => n + 1);
      refs.current[0]?.focus();
    }
  }, [state]);

  const code = digits.join("");
  const locked = state.status === "locked";

  const setAt = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      // paste
      const next = clean.slice(0, LENGTH).split("");
      setDigits([...next, ...Array(LENGTH - next.length).fill("")]);
      refs.current[Math.min(next.length, LENGTH - 1)]?.focus();
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < LENGTH - 1) refs.current[i + 1]?.focus();
  };

  return (
    <main className={s.screen}>
      <div className={s.panel}>
        <Mark size={44} className={s.mark} />
        <h1 className={s.title}>HIMVEDA</h1>
        <p className={s.sub}>Authorized access</p>

        <form ref={form} action={action} className={s.form} autoComplete="off">
          <fieldset className={s.cells} disabled={pending || locked} data-shake={shake || undefined} key={shake}>
            <legend className="sr-only">Access code, {LENGTH} digits</legend>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                className={s.cell}
                inputMode="numeric"
                pattern="[0-9]*"
                type="password"
                maxLength={LENGTH}
                aria-label={`Digit ${i + 1} of ${LENGTH}`}
                value={d}
                autoFocus={i === 0}
                onChange={(e) => setAt(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
                  if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
                  if (e.key === "ArrowRight" && i < LENGTH - 1) refs.current[i + 1]?.focus();
                }}
                data-filled={d ? "" : undefined}
              />
            ))}
          </fieldset>
          <input type="hidden" name="code" value={code} />
          <button type="submit" className={s.go} disabled={code.length !== LENGTH || pending || locked}>
            {pending ? "Checking…" : "Continue"}
          </button>
          <p className={s.status} role="status" aria-live="polite">
            {state.status === "invalid" && "That code wasn’t accepted."}
            {state.status === "locked" && `Too many attempts. Try again in about ${state.minutes} minute${state.minutes === 1 ? "" : "s"}.`}
            {state.status === "unavailable" && "Access isn’t configured on this server yet."}
          </p>
        </form>
      </div>
      <Link href="/" className={s.back}>
        Back to himvedanepal.com
      </Link>
    </main>
  );
}
