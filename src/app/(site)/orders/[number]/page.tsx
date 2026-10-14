import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { formatMoney } from "@/lib/currency/config";
import { ClearCart } from "@/components/cart/ClearCart";
import s from "@/components/page/page.module.css";

export const metadata: Metadata = { title: "Order request received", robots: { index: false } };

type Params = Promise<{ number: string }>;

export default async function OrderPage({ params }: { params: Params }) {
  const { number } = await params;
  const jar = await cookies();
  const token = /^HV-\d{4}-\d{4}$/.test(number) ? jar.get(`hv_order_${number}`)?.value : undefined;
  const order = token ? await db.query.orders.findFirst({ where: eq(schema.orders.number, number), with: { items: true } }) : null;
  if (!order || order.id !== token) {
    return (
      <div className={`wrap ${s.page}`}>
        <header className={s.head}>
          <h1 className="h1">Order details are private.</h1>
          <p className="lede">This page can only be opened on the device that sent the request. Your confirmation email has the details.</p>
          <Link href="/market" className="btn" style={{ justifySelf: "start" }}>
            Back to the market
          </Link>
        </header>
      </div>
    );
  }
  const approx = order.displayCurrency !== "NPR";
  return (
    <div className={`wrap ${s.page}`}>
      <ClearCart />
      <header className={s.head}>
        <p className="margin-note">Order request received</p>
        <h1 className="h1">
          Thank you, {order.customerName.split(" ")[0]}. Your request is <span className="code">{order.number}</span>.
        </h1>
        <p className="lede">
          Nothing has been charged. HIMVEDA will email {order.email} to confirm availability, delivery and payment.
        </p>
      </header>
      <div className={s.summaryBox} style={{ maxWidth: 720 }}>
        <table className={s.orderTable}>
          <caption className="sr-only">Items</caption>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Batch</th>
              <th scope="col">Qty</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id}>
                <td>
                  {i.productName} · {i.variantLabel}
                </td>
                <td>{i.batchCode ? <Link href={`/trace/${i.batchCode}`} className="code">{i.batchCode}</Link> : "—"}</td>
                <td className="num">{i.quantity}</td>
                <td className="num">{formatMoney(i.displayUnitPriceMinor * i.quantity, order.displayCurrency, { approx })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
          <span>Subtotal</span>
          <span>{formatMoney(order.displaySubtotalMinor, order.displayCurrency, { approx })}</span>
        </p>
        {approx ? <p className="small muted">Recorded in NPR as {formatMoney(order.subtotalMinor, "NPR")}.</p> : null}
      </div>
    </div>
  );
}
