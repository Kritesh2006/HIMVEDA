import Link from "next/link";
import { listMessages, listOrders } from "@/server/ops/admin";
import { formatMoney } from "@/lib/currency/config";
import { MessageToggle, OrderStatus } from "@/components/studio/forms";
import { fmtDate } from "@/lib/format";
import st from "@/components/studio/studio.module.css";

export const metadata = { title: "Orders" };

type SP = Promise<Record<string, string | undefined>>;

export default async function OrdersPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const view = sp.view === "messages" ? "messages" : "orders";
  const [orders, messages] = await Promise.all([listOrders(), listMessages()]);
  return (
    <>
      <div className={st.pageHead}>
        <div>
          <h1>Orders</h1>
          <p>Order requests from the website. Confirm price, delivery and payment with the customer, then move the order along.</p>
        </div>
      </div>
      <nav className={st.tabs} aria-label="Orders view">
        <Link href="/studio/orders" aria-current={view === "orders" ? "page" : undefined}>
          Order requests ({orders.length})
        </Link>
        <Link href="/studio/orders?view=messages" aria-current={view === "messages" ? "page" : undefined}>
          Contact messages ({messages.filter((m) => !m.handled).length} open)
        </Link>
      </nav>
      {view === "orders" ? (
        <div className={st.panel}>
          {orders.length ? (
            <div className={st.tableWrap}>
              <table className={st.table}>
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Items</th>
                    <th scope="col" className={st.num}>
                      Total (NPR)
                    </th>
                    <th scope="col" className={st.num}>
                      Shown to customer
                    </th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <strong className="code">{o.number}</strong>
                        {o.isDemo ? (
                          <>
                            {" "}
                            <span className="tag tag-sample">Sample</span>
                          </>
                        ) : null}
                        <div className={st.muted}>{fmtDate(o.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                      </td>
                      <td className={st.wrap}>
                        {o.customerName}
                        <div className={st.muted}>
                          <a href={`mailto:${o.email}`}>{o.email}</a>
                          {o.phone ? ` · ${o.phone}` : ""} · {o.country}
                          {o.city ? `, ${o.city}` : ""}
                        </div>
                      </td>
                      <td className={st.wrap}>
                        {o.items.map((i) => (
                          <div key={i.id}>
                            {i.quantity} × {i.productName} · {i.variantLabel}
                            {i.batchCode ? <span className={st.muted}> ({i.batchCode})</span> : null}
                          </div>
                        ))}
                      </td>
                      <td className={st.num}>{formatMoney(o.subtotalMinor, "NPR")}</td>
                      <td className={st.num}>{formatMoney(o.displaySubtotalMinor, o.displayCurrency, { approx: o.displayCurrency !== "NPR" })}</td>
                      <td>
                        <OrderStatus orderId={o.id} status={o.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={st.empty}>No order requests yet. They appear here as soon as a visitor sends one.</p>
          )}
        </div>
      ) : (
        <div className={st.panel}>
          {messages.length ? (
            <table className={st.table}>
              <tbody>
                {messages.map((m) => (
                  <tr key={m.id} style={{ opacity: m.handled ? 0.55 : 1 }}>
                    <td style={{ verticalAlign: "top" }}>
                      <strong>{m.name}</strong>
                      <div className={st.muted}>
                        <a href={`mailto:${m.email}`}>{m.email}</a>
                      </div>
                      <div className={st.muted}>
                        {m.topic} · {fmtDate(m.createdAt, { day: "numeric", month: "short" })}
                      </div>
                    </td>
                    <td className={st.wrap} style={{ whiteSpace: "pre-line" }}>
                      {m.message}
                    </td>
                    <td style={{ verticalAlign: "top" }}>
                      <MessageToggle id={m.id} handled={m.handled} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className={st.empty}>No messages yet.</p>
          )}
        </div>
      )}
    </>
  );
}
