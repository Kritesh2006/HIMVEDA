"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { cart, useCart, useCartCount } from "./cart-store";
import { priceCartAction } from "@/app/actions/cart";
import { Price } from "@/components/currency/Price";
import { Specimen } from "@/components/specimen/Specimen";
import { MediaImage } from "@/components/product/MediaImage";
import styles from "./Cart.module.css";

type Priced = Awaited<ReturnType<typeof priceCartAction>>;

/** Fetch server-side prices for the current cart whenever it (or the currency) changes. */
export function usePricedCart(refreshKey = 0) {
  const lines = useCart();
  const [data, setData] = useState<Priced | null>(null);
  const [pending, start] = useTransition();
  const seq = useRef(0);
  const key = JSON.stringify(lines);
  useEffect(() => {
    const mine = ++seq.current;
    start(async () => {
      const res = await priceCartAction(lines);
      if (mine !== seq.current) return; // a newer request superseded this one
      setData(res);
      // Drop lines that no longer exist (unpublished / removed)
      const valid = new Set(res.lines.map((l) => l.variantId));
      lines.filter((l) => !valid.has(l.variantId)).forEach((l) => cart.remove(l.variantId));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshKey]);
  return { lines, data, pending: !data, refreshing: pending };
}

export function CartLines({ data, compact = false }: { data: Priced; compact?: boolean }) {
  return (
    <ul role="list" className={styles.lines} data-compact={compact || undefined}>
      {data.lines.map((l) => (
        <li key={l.variantId} className={styles.line}>
          <Link href={`/products/${l.productSlug}`} className={styles.thumb} tabIndex={-1} aria-hidden="true">
            {l.imageId ? <MediaImage id={l.imageId} alt="" /> : <Specimen visual={l.visual} size="thumb" />}
          </Link>
          <div className={styles.lineBody}>
            <Link href={`/products/${l.productSlug}`} className={styles.lineName}>
              {l.productName}
            </Link>
            <span className={styles.lineVariant}>
              {l.variantLabel} · <Price minor={l.unitPrice.amountMinor} currency={l.unitPrice.currency} approx={l.unitPrice.approximate} /> each
            </span>
            <div className={styles.qtyRow}>
              <div className={styles.qty} role="group" aria-label={`Quantity of ${l.productName} ${l.variantLabel}`}>
                <button type="button" onClick={() => (l.quantity > 1 ? cart.set(l.variantId, l.quantity - 1) : cart.remove(l.variantId))} aria-label="Decrease quantity">
                  −
                </button>
                <output aria-live="polite">{l.quantity}</output>
                <button type="button" onClick={() => cart.set(l.variantId, l.quantity + 1)} disabled={l.quantity >= Math.min(99, l.stock)} aria-label="Increase quantity">
                  +
                </button>
              </div>
              <button type="button" className={styles.remove} onClick={() => cart.remove(l.variantId)}>
                Remove
              </button>
            </div>
            {l.quantity > l.stock ? <span className="error-text">Only {l.stock} available</span> : null}
          </div>
          <Price minor={l.lineMinor} currency={l.unitPrice.currency} approx={l.unitPrice.approximate} className={styles.lineTotal} />
        </li>
      ))}
    </ul>
  );
}

export function CartSummary({ data }: { data: Priced }) {
  return (
    <div className={styles.summary}>
      <div className={styles.total}>
        <span>Subtotal</span>
        <Price minor={data.totalMinor} currency={data.currency} approx={data.approximate} />
      </div>
      {data.currency !== "NPR" ? (
        <p className={styles.fine}>
          Recorded in NPR as <Price minor={data.totalBaseMinor} currency="NPR" />. {data.approximate ? "Converted amounts are approximate. " : ""}
          Delivery and payment are confirmed with you before anything is charged.
        </p>
      ) : (
        <p className={styles.fine}>Delivery and payment are confirmed with you before anything is charged.</p>
      )}
    </div>
  );
}

export function CartButton() {
  const count = useCartCount();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    const onAdded = () => {
      setBump((b) => b + 1);
      dialog.current?.showModal();
      setOpen(true);
    };
    window.addEventListener("himveda:cart-added", onAdded);
    return () => window.removeEventListener("himveda:cart-added", onAdded);
  }, []);

  const close = () => {
    dialog.current?.close();
  };

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}
        aria-haspopup="dialog"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 8h14l-1.2 11.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8L5 8Z M9 8V6.5a3 3 0 0 1 6 0V8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
        <span className="sr-only">Cart,</span>
        <span key={bump} className={styles.count} data-bump={bump > 0 || undefined}>
          {count}
        </span>
        <span className="sr-only">{count === 1 ? "item" : "items"}</span>
      </button>
      <dialog
        ref={dialog}
        className={styles.drawer}
        aria-label="Cart"
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialog.current && close()}
      >
        {open ? <DrawerBody onClose={close} /> : null}
      </dialog>
    </>
  );
}

function DrawerBody({ onClose }: { onClose: () => void }) {
  const { lines, data, pending } = usePricedCart();
  return (
    <div className={styles.drawerInner}>
      <div className={styles.drawerHead}>
        <h2 className="h3">Your cart</h2>
        <button type="button" className={styles.closeBtn} onClick={onClose}>
          Close
        </button>
      </div>
      {pending ? (
        <div className={styles.loading} aria-live="polite">
          <span className={styles.loadingLine} />
          <span className="sr-only">Loading prices</span>
        </div>
      ) : !lines.length || !data?.lines.length ? (
        <div className={styles.empty}>
          <p className="h3">Nothing here yet.</p>
          <p className="muted">Every product in the market carries its batch code and trace record.</p>
          <Link href="/market" className="btn" onClick={onClose}>
            Browse the market
          </Link>
        </div>
      ) : (
        <>
          <div className={styles.scroll}>
            <CartLines data={data} compact />
          </div>
          <div className={styles.drawerFoot}>
            <CartSummary data={data} />
            <Link href="/checkout" className="btn btn-block" onClick={onClose} data-magnetic>
              Request this order
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
