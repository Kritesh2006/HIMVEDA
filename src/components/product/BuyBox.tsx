"use client";

import { useId, useState } from "react";
import { cart } from "@/components/cart/cart-store";
import { Price } from "@/components/currency/Price";
import s from "./product.module.css";

interface V {
  id: string;
  label: string;
  stock: number;
  isDefault: boolean;
  price: { amountMinor: number; currency: string; approximate: boolean; override: boolean; baseMinor: number };
}

export function BuyBox({ variants, disabled, devRates }: { variants: V[]; disabled?: boolean; devRates: boolean }) {
  const initial = variants.find((v) => v.isDefault && v.stock > 0) ?? variants.find((v) => v.stock > 0) ?? variants[0];
  const [id, setId] = useState(initial?.id);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const name = useId();
  const v = variants.find((x) => x.id === id) ?? variants[0];
  if (!v) return null;
  const max = Math.max(0, Math.min(99, v.stock));
  const out = v.stock <= 0;

  return (
    <div className={s.buy}>
      <div className={s.priceRow}>
        <Price minor={v.price.amountMinor} currency={v.price.currency} approx={v.price.approximate} className={s.price} />
        {v.price.currency !== "NPR" ? (
          <span className={s.priceNote}>
            {v.price.approximate ? (
              <>
                Converted from <Price minor={v.price.baseMinor} currency="NPR" />
                {devRates ? " at a reference rate" : ""}
              </>
            ) : (
              "Price set in this currency"
            )}
          </span>
        ) : null}
      </div>

      {variants.length > 1 ? (
        <fieldset className={s.variants}>
          <legend>Size</legend>
          <div className={s.variantGrid}>
            {variants.map((x) => (
              <label key={x.id} className={s.variant} data-out={x.stock <= 0 || undefined}>
                <input
                  type="radio"
                  name={name}
                  value={x.id}
                  checked={x.id === id}
                  onChange={() => {
                    setId(x.id);
                    setQty(1);
                    setAdded(false);
                  }}
                />
                <span className={s.variantLabel}>{x.label}</span>
                <Price minor={x.price.amountMinor} currency={x.price.currency} approx={x.price.approximate} className={s.variantPrice} />
                {x.stock <= 0 ? <span className={s.variantOut}>Out of stock</span> : null}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className={s.single}>{v.label}</p>
      )}

      <div className={s.actions}>
        <div className={s.qty} role="group" aria-label="Quantity">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1 || out} aria-label="Decrease quantity">
            −
          </button>
          <output aria-live="polite">{qty}</output>
          <button type="button" onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max || out} aria-label="Increase quantity">
            +
          </button>
        </div>
        <button
          type="button"
          className="btn"
          data-magnetic
          disabled={out || disabled}
          onClick={() => {
            cart.add(v.id, qty);
            setAdded(true);
          }}
        >
          {out ? "Out of stock" : added ? "Added — add more" : "Add to cart"}
        </button>
      </div>
      <p className={s.stock} data-state={out ? "out" : v.stock < 10 ? "low" : "in"}>
        {out ? "This size is out of stock." : v.stock < 10 ? `Only ${v.stock} left in this batch.` : "In stock, ready to pack."}
      </p>
      {disabled ? <p className="hint">Preview mode: adding to cart is disabled.</p> : null}
    </div>
  );
}
