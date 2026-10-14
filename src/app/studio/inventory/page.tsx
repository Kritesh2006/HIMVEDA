import Link from "next/link";
import { getInventory } from "@/server/ops/admin";
import { StockAdjust } from "@/components/studio/forms";
import { fmtDate } from "@/lib/format";
import st from "@/components/studio/studio.module.css";

export const metadata = { title: "Inventory" };

export default async function InventoryPage() {
  const { variants, movements } = await getInventory();
  return (
    <>
      <div className={st.pageHead}>
        <div>
          <h1>Inventory</h1>
          <p>Stock per product size. Every change is recorded as a movement with a reason.</p>
        </div>
      </div>
      <div className={st.panel}>
        <div className={st.tableWrap}>
          <table className={st.table}>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Size</th>
                <th scope="col">SKU</th>
                <th scope="col" className={st.num}>
                  In stock
                </th>
                <th scope="col">Adjust</th>
              </tr>
            </thead>
            <tbody>
              {variants
                .filter((v) => v.product.status !== "archived")
                .map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/studio/products/${v.product.id}`} className={st.rowLink}>
                        {v.product.name}
                      </Link>
                      {v.product.status !== "published" ? <span className={st.muted}> · draft</span> : null}
                    </td>
                    <td>{v.label}</td>
                    <td className="code">{v.sku}</td>
                    <td className={st.num} style={{ color: v.stock === 0 ? "var(--danger)" : v.stock < 10 ? "var(--marigold-ink)" : undefined, fontWeight: 600 }}>
                      {v.stock}
                    </td>
                    <td>
                      <StockAdjust variantId={v.id} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      <section className={st.panel} style={{ marginTop: 18 }}>
        <div className={st.panelHead}>
          <h2>Recent movements</h2>
        </div>
        <div className={st.tableWrap}>
          <table className={st.table}>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Item</th>
                <th scope="col" className={st.num}>
                  Change
                </th>
                <th scope="col">Reason</th>
                <th scope="col">Route</th>
                <th scope="col">Reference</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td>{fmtDate(m.movedAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                  <td>{m.variant ? `${m.variant.product.name} · ${m.variant.label}` : m.batch ? <span className="code">{m.batch.code}</span> : "—"}</td>
                  <td className={st.num}>
                    {m.quantity > 0 ? "+" : ""}
                    {m.quantityUnit === "g" ? `${(m.quantity / 1000).toFixed(1)} kg` : m.quantity}
                  </td>
                  <td>{m.reason.replace(/_/g, " ")}</td>
                  <td className={st.muted}>{[m.from?.name, m.to?.name].filter(Boolean).join(" → ") || "—"}</td>
                  <td>{m.reference ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
