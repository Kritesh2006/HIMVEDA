"use client";

import { useSyncExternalStore } from "react";

export interface CartLine {
  variantId: string;
  quantity: number;
}

const KEY = "himveda.cart";
const listeners = new Set<() => void>();
let memory: CartLine[] = [];
let snapshot: CartLine[] = [];
let loaded = false;

function read(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l): l is CartLine => typeof l?.variantId === "string" && Number.isInteger(l?.quantity))
      .map((l) => ({ variantId: l.variantId, quantity: Math.max(1, Math.min(99, l.quantity)) }))
      .slice(0, 50);
  } catch {
    return memory;
  }
}

function write(lines: CartLine[]) {
  memory = lines;
  snapshot = lines;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* private mode: keep in memory for this tab */
  }
  listeners.forEach((l) => l());
}

function ensure() {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    snapshot = read();
    window.addEventListener("storage", (e) => {
      if (e.key === KEY) {
        snapshot = read();
        listeners.forEach((l) => l());
      }
    });
  }
}

export const cart = {
  subscribe(cb: () => void) {
    ensure();
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  get(): CartLine[] {
    ensure();
    return snapshot;
  },
  add(variantId: string, quantity = 1) {
    const lines = [...cart.get()];
    const hit = lines.find((l) => l.variantId === variantId);
    if (hit) hit.quantity = Math.min(99, hit.quantity + quantity);
    else lines.push({ variantId, quantity: Math.min(99, quantity) });
    write(lines.map((l) => ({ ...l })));
    window.dispatchEvent(new CustomEvent("himveda:cart-added", { detail: { variantId, quantity } }));
  },
  set(variantId: string, quantity: number) {
    write(
      cart
        .get()
        .map((l) => (l.variantId === variantId ? { ...l, quantity: Math.max(1, Math.min(99, quantity)) } : l)),
    );
  },
  remove(variantId: string) {
    write(cart.get().filter((l) => l.variantId !== variantId));
  },
  clear() {
    write([]);
  },
};

const EMPTY: CartLine[] = [];
export function useCart(): CartLine[] {
  return useSyncExternalStore(cart.subscribe, cart.get, () => EMPTY);
}
export function useCartCount(): number {
  return useCart().reduce((s, l) => s + l.quantity, 0);
}
