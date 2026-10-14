import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { priceCart } from "@/server/catalog/queries";
import { writeAudit } from "@/server/audit";

export const orderRequestInput = z.object({
  customerName: z.string().trim().min(2, "Please enter your name").max(120),
  email: z.string().trim().email("Please enter a valid email").max(200),
  phone: z.string().trim().max(40).optional().transform((v) => v || null),
  country: z.string().trim().regex(/^[A-Z]{2}$/, "Choose a country"),
  city: z.string().trim().max(120).optional().transform((v) => v || null),
  address: z.string().trim().max(500).optional().transform((v) => v || null),
  notes: z.string().trim().max(1000).optional().transform((v) => v || null),
  lines: z
    .array(z.object({ variantId: z.string().uuid(), quantity: z.coerce.number().int().min(1).max(99) }))
    .min(1, "Your cart is empty")
    .max(50),
});

export class OrderError extends Error {}

function orderNumber(now = new Date()) {
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `HV-${yy}${mm}-${rand}`;
}

/**
 * Create an order REQUEST. No payment is taken: HIMVEDA confirms price, delivery
 * and payment with the customer directly. Prices are recomputed server-side;
 * the NPR subtotal is the amount of record. Stock is reserved atomically.
 */
export async function createOrderRequest(raw: unknown) {
  const input = orderRequestInput.parse(raw);
  const { lines, ctx } = await priceCart(input.lines);
  if (!lines.length) throw new OrderError("Those items are no longer available.");

  return db.transaction(async (tx) => {
    for (const l of lines) {
      const updated = await tx
        .update(schema.productVariants)
        .set({ stock: sql`${schema.productVariants.stock} - ${l.quantity}` })
        .where(and(eq(schema.productVariants.id, l.variantId), gte(schema.productVariants.stock, l.quantity)))
        .returning({ id: schema.productVariants.id });
      if (!updated.length) throw new OrderError(`Only ${l.stock} left of ${l.productName} · ${l.variantLabel}.`);
    }
    const displayCurrency = lines[0]!.unitPrice.currency;
    let number = orderNumber();
    for (let i = 0; i < 5; i++) {
      const clash = await tx.query.orders.findFirst({ where: eq(schema.orders.number, number), columns: { id: true } });
      if (!clash) break;
      number = orderNumber();
    }
    const [order] = await tx
      .insert(schema.orders)
      .values({
        number,
        customerName: input.customerName,
        email: input.email,
        phone: input.phone,
        country: input.country,
        city: input.city,
        address: input.address,
        notes: input.notes,
        displayCurrency,
        fxRatePerNpr: ctx.rate ? ctx.rate.toFixed(10) : null,
        subtotalMinor: lines.reduce((s, l) => s + l.lineBaseMinor, 0),
        displaySubtotalMinor: lines.reduce((s, l) => s + l.lineMinor, 0),
        isDemo: lines.every((l) => l.isDemo),
      })
      .returning();
    const batchCodes = await tx.query.productVariants.findMany({
      where: (v, { inArray }) => inArray(v.id, lines.map((l) => l.variantId)),
      columns: { id: true },
      with: { product: { columns: {}, with: { primaryBatch: { columns: { code: true } } } } },
    });
    await tx.insert(schema.orderItems).values(
      lines.map((l) => ({
        orderId: order!.id,
        variantId: l.variantId,
        productName: l.productName,
        variantLabel: l.variantLabel,
        batchCode: batchCodes.find((b) => b.id === l.variantId)?.product.primaryBatch?.code ?? null,
        quantity: l.quantity,
        unitPriceMinor: l.unitPrice.baseMinor,
        displayUnitPriceMinor: l.unitPrice.amountMinor,
      })),
    );
    await tx.insert(schema.inventoryMovements).values(
      lines.map((l) => ({ variantId: l.variantId, quantity: -l.quantity, quantityUnit: "unit", reason: "sale", reference: number })),
    );
    await writeAudit(null, { action: "order.request", entityType: "order", entityId: order!.id, summary: `Order request ${number} received (${lines.length} line${lines.length > 1 ? "s" : ""})` }, tx);
    return { number, id: order!.id };
  });
}

export async function getOrderConfirmation(number: string, email: string) {
  if (!/^HV-\d{4}-\d{4}$/.test(number)) return null;
  const o = await db.query.orders.findFirst({ where: eq(schema.orders.number, number), with: { items: true } });
  if (!o || o.email.toLowerCase() !== email.toLowerCase()) return null;
  return o;
}
