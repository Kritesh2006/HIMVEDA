"use server";

import { z } from "zod";
import { priceCart } from "@/server/catalog/queries";
import { isDevRates } from "@/server/currency/service";

const lines = z.array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(99) })).max(50);

/** Prices the visitor's cart from the database in their current display currency. */
export async function priceCartAction(input: unknown) {
  const parsed = lines.safeParse(input);
  if (!parsed.success) return { lines: [], currency: "NPR", totalMinor: 0, totalBaseMinor: 0, approximate: false, devRates: false };
  const { lines: priced, ctx } = await priceCart(parsed.data);
  const currency = priced[0]?.unitPrice.currency ?? ctx.currency;
  return {
    lines: priced,
    currency,
    totalMinor: priced.reduce((s, l) => s + l.lineMinor, 0),
    totalBaseMinor: priced.reduce((s, l) => s + l.lineBaseMinor, 0),
    approximate: priced.some((l) => l.unitPrice.approximate),
    devRates: isDevRates(ctx),
  };
}
