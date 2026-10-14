import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { listCenters, listReceipts } from "@/server/ops/agri";
import { CenterDialog, InspectDialog, PayDialog, ProcureButton, ReceiptDialog } from "@/components/studio/forms";
import { formatMoney } from "@/lib/currency/config";
import { fmtDate, fmtKg } from "@/lib/format";
import st from "@/components/studio/studio.module.css";

export const metadata = { title: "Collection" };

type SP = Promise<Record<string, string | undefined>>;
const STATUS_TONE: Record<string, string> = { received: "warn", inspected: "warn", accepted: "warn", procured: "ok", rejected: "bad" };

export default async function CollectionPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const view = sp.view === "payments" ? "payments" : sp.view === "centres" ? "centres" : "receipts";
  const [receipts, centers, farmers, payments] = await Promise.all([
    listReceipts(sp.status),
    listCenters(),
    db.select({ id: schema.farmers.id, code: schema.farmers.code, name: schema.farmers.fullName }).from(schema.farmers).where(eq(schema.farmers.active, true)).orderBy(asc(schema.farmers.code)),
    db.query.farmerPayments.findMany({ orderBy: [desc(schema.farmerPayments.createdAt)], limit: 100, with: { farmer: { columns: { code: true, fullName: true } }, procurement: { with: { receipt: { columns: { receiptNo: true } } } } } }),
  ]);
  const tabs = [
    ["receipts", "/studio/collection", "Receipts"],
    ["payments", "/studio/collection?view=payments", `Producer payments (${payments.filter((p) => p.status !== "paid").length} open)`],
    ["centres", "/studio/collection?view=centres", `Centres (${centers.length})`],
  ];
  return (
    <>
      <div className={st.pageHead}>
        <div>
          <h1>Collection</h1>
          <p>Deliveries at collection centres: weigh → inspect → procure → pay. Each step is recorded and attributed.</p>
        </div>
        <div className={st.pageActions}>
          <ReceiptDialog farmers={farmers.map((f) => ({ id: f.id, label: `${f.code} · ${f.name}` }))} centers={centers.map((c) => ({ id: c.id, label: `${c.code} · ${c.name}` }))} />
        </div>
      </div>
      <nav className={st.tabs} aria-label="Collection views">
        {tabs.map(([k, href, l]) => (
          <Link key={k} href={href!} aria-current={view === k ? "page" : undefined}>
            {l}
          </Link>
        ))}
      </nav>

      {view === "receipts" ? (
        <>
          <nav className={st.tabs} aria-label="Filter by status">
            {["all", "received", "accepted", "procured", "rejected"].map((s) => (
              <Link key={s} href={s === "all" ? "/studio/collection" : `/studio/collection?status=${s}`} aria-current={(sp.status ?? "all") === s ? "page" : undefined}>
                {s[0]!.toUpperCase() + s.slice(1)}
              </Link>
            ))}
          </nav>
          <div className={st.panel}>
            {receipts.length ? (
              <div className={st.tableWrap}>
                <table className={st.table}>
                  <thead>
                    <tr>
                      <th scope="col">Receipt</th>
                      <th scope="col">Producer</th>
                      <th scope="col">Commodity</th>
                      <th scope="col" className={st.num}>
                        Net
                      </th>
                      <th scope="col">Inspection</th>
                      <th scope="col" className={st.num}>
                        Procured
                      </th>
                      <th scope="col">Status</th>
                      <th scope="col">Next step</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.map((r) => {
                      const insp = r.inspections.at(-1);
                      return (
                        <tr key={r.id}>
                          <td>
                            <strong className="code">{r.receiptNo}</strong>
                            <div className={st.muted}>
                              {r.collectionCenter.code} · {fmtDate(r.receivedAt, { day: "numeric", month: "short" })}
                            </div>
                          </td>
                          <td>
                            {r.farmer.fullName}
                            <div className={st.muted}>{r.farmer.code}</div>
                          </td>
                          <td>{r.commodity}</td>
                          <td className={st.num}>{fmtKg(r.netGrams / 1000)}</td>
                          <td>{insp ? `${insp.result.toUpperCase()} · ${insp.visualGrade} · ${fmtKg((insp.acceptedGrams ?? 0) / 1000)}` : <span className={st.muted}>—</span>}</td>
                          <td className={st.num}>{r.procurement ? formatMoney(r.procurement.totalMinor, "NPR") : "—"}</td>
                          <td>
                            <span className={st.status} data-tone={STATUS_TONE[r.status]}>
                              {r.status}
                            </span>
                            {r.batchLinks[0] ? <div className="code small">{r.batchLinks[0].batch.code}</div> : null}
                          </td>
                          <td>
                            {r.status === "received" || r.status === "inspected" ? (
                              <InspectDialog receiptId={r.id} receiptNo={r.receiptNo} netKg={r.netGrams / 1000} />
                            ) : r.status === "accepted" ? (
                              <ProcureButton receiptId={r.id} />
                            ) : r.status === "procured" && !r.batchLinks.length ? (
                              <Link href="/studio/traceability/new" className="btn btn-ghost btn-small">
                                Add to a batch
                              </Link>
                            ) : (
                              <span className={st.muted}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={st.empty}>No receipts with this status.</p>
            )}
          </div>
        </>
      ) : view === "payments" ? (
        <div className={st.panel}>
          <table className={st.table}>
            <thead>
              <tr>
                <th scope="col">Producer</th>
                <th scope="col">Receipt</th>
                <th scope="col" className={st.num}>
                  Amount
                </th>
                <th scope="col">Status</th>
                <th scope="col">Method</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.farmer.fullName} <span className={st.muted}>{p.farmer.code}</span>
                  </td>
                  <td className="code">{p.procurement?.receipt.receiptNo ?? "—"}</td>
                  <td className={st.num}>{formatMoney(p.amountMinor, "NPR")}</td>
                  <td>
                    <span className={st.status} data-tone={p.status === "paid" ? "ok" : "warn"}>
                      {p.status}
                    </span>
                    {p.paidAt ? <div className={st.muted}>{fmtDate(p.paidAt)}</div> : null}
                  </td>
                  <td>
                    {p.method ?? "—"}
                    {p.reference ? <div className={st.muted}>{p.reference}</div> : null}
                  </td>
                  <td>{p.status !== "paid" ? <PayDialog paymentId={p.id} amount={formatMoney(p.amountMinor, "NPR")} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={st.panel}>
          <div className={st.panelHead}>
            <h2>Collection centres</h2>
            <CenterDialog />
          </div>
          <table className={st.table}>
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Centre</th>
                <th scope="col">District</th>
                <th scope="col">Public</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {centers.map((c) => (
                <tr key={c.id}>
                  <td className="code">{c.code}</td>
                  <td>
                    {c.name}
                    {c.isDemo ? (
                      <>
                        {" "}
                        <span className="tag tag-sample">Sample</span>
                      </>
                    ) : null}
                  </td>
                  <td>
                    {c.district}
                    {c.province ? `, ${c.province}` : ""}
                  </td>
                  <td>{c.isPublic ? "Shown" : "Hidden"}</td>
                  <td>
                    <CenterDialog center={c} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
