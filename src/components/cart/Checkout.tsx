"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { CartLines, CartSummary, usePricedCart } from "./CartDrawer";
import { placeOrderRequest } from "@/app/actions/public";
import s from "@/components/page/page.module.css";

const COUNTRIES = ["NP", "IN", "US", "GB", "CA", "AU", "AE", "QA", "SA", "KW", "BH", "OM", "MY", "SG", "JP", "KR", "HK", "DE", "FR", "NL", "BE", "IE", "IT", "ES", "PT", "AT", "CH", "SE", "DK", "NO", "FI", "PL", "NZ", "BD", "BT", "LK", "IL", "CY"];

export function Checkout({ defaultCountry }: { defaultCountry: string | null }) {
  const { lines, data, pending: loading } = usePricedCart();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const names = useMemo(() => {
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    return COUNTRIES.map((c) => [c, dn.of(c) ?? c] as const).sort((a, b) => (a[0] === "NP" ? -1 : b[0] === "NP" ? 1 : a[1].localeCompare(b[1])));
  }, []);

  if (loading) return <p className="muted">Loading your cart…</p>;
  if (!lines.length || !data?.lines.length)
    return (
      <div className={s.success}>
        <h2 className="h2">Your cart is empty.</h2>
        <p className="muted">Add something from the market first.</p>
        <Link href="/market" className="btn" style={{ justifySelf: "start" }}>
          Browse the market
        </Link>
      </div>
    );

  const submit = (form: FormData) => {
    const payload = { ...Object.fromEntries(form), lines: data.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })) };
    start(async () => {
      const res = await placeOrderRequest(payload); // redirects on success
      if (res && !res.ok) {
        setError(res.error);
        setErrors(res.field ?? {});
      }
    });
  };

  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="field">
      <span>{label}</span>
      <input name={name} className="input" aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `e-${name}` : undefined} {...props} />
      {errors[name] ? (
        <span id={`e-${name}`} className="error-text">
          {errors[name]}
        </span>
      ) : null}
    </label>
  );

  return (
    <div className={s.twoCol}>
      <form action={submit} className={s.form} noValidate>
        <h2 className="h3">Your details</h2>
        <div className={s.formRow}>
          {field("customerName", "Full name", { autoComplete: "name", required: true })}
          {field("email", "Email", { type: "email", autoComplete: "email", required: true })}
        </div>
        <div className={s.formRow}>
          {field("phone", "Phone (optional)", { type: "tel", autoComplete: "tel" })}
          <label className="field">
            <span>Country</span>
            <select name="country" className="select" defaultValue={defaultCountry && COUNTRIES.includes(defaultCountry) ? defaultCountry : "NP"} autoComplete="country">
              {names.map(([c, n]) => (
                <option key={c} value={c}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        {field("city", "City", { autoComplete: "address-level2" })}
        <label className="field">
          <span>Delivery address</span>
          <textarea name="address" className="textarea" rows={3} autoComplete="street-address" />
        </label>
        <label className="field">
          <span>Notes (optional)</span>
          <textarea name="notes" className="textarea" rows={3} />
        </label>
        <p className={s.notice}>
          This sends an order request — nothing is charged now. HIMVEDA will confirm availability, delivery cost and payment
          details with you by email before anything is paid.
        </p>
        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn" disabled={pending} data-magnetic style={{ justifySelf: "start" }}>
          {pending ? "Sending request…" : "Send order request"}
        </button>
      </form>
      <aside className={`${s.summaryBox} ${s.sticky}`} aria-label="Order summary">
        <h2 className="h3">Summary</h2>
        <CartLines data={data} compact />
        <CartSummary data={data} />
      </aside>
    </div>
  );
}
