"use client";

import { useEffect } from "react";
import { cart } from "./cart-store";

/** Rendered on the order confirmation page: the request is stored, so the local cart is emptied. */
export function ClearCart() {
  useEffect(() => {
    cart.clear();
  }, []);
  return null;
}
