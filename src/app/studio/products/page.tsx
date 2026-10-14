import Link from "next/link";
import { asc, desc } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { formatMoney } from "@/lib/currency/config";
import { Specimen } from "@/components/specimen/Specimen";
import st from "@/components/studio/studio.module.css";

export const metadata = { title: "Products" };

type SP = Promise<Record<string, string | undefined>>;

export default async function ProductsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const all = await db.query.products.findMany({
    orderBy: [desc(schema.products.updatedAt)],
    with: { category: true, variants: { orderBy: [asc(schema.productVariants.sortOrder)] }, primaryBatch: { columns: { code: true } } },
  });
  const tab = sp.status ?? "all";
  const rows = all.filter((p) => (tab === "all" ? p.status !== "archived" : tab === "draft" ? p.status === "draft" || p.draft : p.status === tab));
  const n = (s: string) => all.filter((p) => (s === "draft" ? p.status === "draft" || p.draft : p.status === s)).length;
  return (
    <>
      <div className={st.pageHead}>
        <div>
          <h1>Products</h1>
          <p>Prices are set once, in NPR. Every page, cart and search result reads them from here.</p>
        </div>
        <div className={st.pageActions}>
          <Link href="/studio/products/new" className="btn btn-small">
            + Add product
          </Link>
        </div>
      </div>
      <nav className={st.tabs} aria-label="Filter products">
        {[
          ["all", `All (${all.filter((p) => p.status !== "archived").length})`],
          ["published", `Published (${n("published")})`],
          ["draft", `Drafts & changes (${n("draft")})`],
          ["archived", `Archived (${n("archived")})`],
        ].map(([k, l]) => (
          <Link key={k} href={k === "all" ? "/studio/products" : `/studio/products?status=${k}`} aria-current={tab === k ? "page" : undefined}>
            {l}
          </Link>
        ))}
      </nav>
      <div className={st.panel}>
        {rows.length ? (
          <div className={st.tableWrap}>
            <table className={st.table}>
              <thead>
                <tr>
                  <th scope="col" style={{ width: 52 }}>
                    <span className="sr-only">Image</span>
                  </th>
                  <th scope="col">Product</th>
                  <th scope="col">Status</th>
                  <th scope="col">Category</th>
                  <th scope="col" className={st.num}>
                    Base price
                  </th>
                  <th scope="col" className={st.num}>
                    Stock
                  </th>
                  <th scope="col">Batch</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const prices = p.variants.map((v) => v.basePriceMinor);
                  const stock = p.variants.reduce((s, v) => s + v.stock, 0);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ width: 40 }}>
                          <Specimen visual={p.visual} size="thumb" />
                        </div>
                      </td>
                      <td>
                        <Link href={`/studio/products/${p.id}`} className={st.rowLink}>
                          {p.name}
                        </Link>
                        {p.isDemo ? (
                          <>
                            {" "}
                            <span className="tag tag-sample">Sample</span>
                          </>
                        ) : null}
                        <div className={st.muted}>/{p.slug}</div>
                      </td>
                      <td>
                        <span className={st.status} data-tone={p.status === "published" ? "ok" : p.status === "draft" ? "warn" : undefined}>
                          {p.status === "published" ? "Published" : p.status === "draft" ? "Draft" : "Archived"}
                        </span>
                        {p.draft ? (
                          <>
                            {" "}
                            <span className={st.status} data-tone="warn">
                              Unpublished changes
                            </span>
                          </>
                        ) : null}
                      </td>
                      <td>{p.category?.name ?? "—"}</td>
                      <td className={st.num}>
                        {prices.length
                          ? Math.min(...prices) === Math.max(...prices)
                            ? formatMoney(prices[0]!, "NPR")
                            : `${formatMoney(Math.min(...prices), "NPR")} – ${formatMoney(Math.max(...prices), "NPR").replace("रू ", "")}`
                          : "—"}
                      </td>
                      <td className={st.num} style={{ color: stock === 0 ? "var(--danger)" : undefined }}>
                        {stock}
                      </td>
                      <td className="code">{p.primaryBatch?.code ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={st.empty}>
            No products here yet. <Link href="/studio/products/new">Add the first product</Link> — only a name, a size and a price are needed to start.
          </p>
        )}
      </div>
    </>
  );
}
