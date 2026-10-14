import Link from "next/link";
import { notFound } from "next/navigation";
import { getBatch } from "@/server/ops/agri";
import { listMedia } from "@/server/ops/admin";
import { BatchPublicToggle, EventDialog, RunDialog, TestDialog } from "@/components/studio/forms";
import { STAGE_LABEL, fmtDate, fmtKg } from "@/lib/format";
import st from "@/components/studio/studio.module.css";

export const metadata = { title: "Batch" };

export default async function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [b, media] = await Promise.all([getBatch(id), listMedia()]);
  if (!b) notFound();
  const docs = media.filter((m) => m.mimeType === "application/pdf").map((m) => ({ id: m.id, label: m.alt || m.filename }));
  return (
    <>
      <div className={st.pageHead}>
        <div>
          <Link href="/studio/traceability" className="small">
            Traceability
          </Link>
          <h1 className="code">{b.code}</h1>
          <p>
            {b.commodity} · {STAGE_LABEL[b.stage]} · {b.isPublic ? "trace page is public" : "trace page is hidden"}
            {b.isDemo ? " · sample data" : ""}
          </p>
        </div>
        <div className={st.pageActions}>
          {b.isPublic ? (
            <Link href={`/trace/${b.code}`} target="_blank" className="btn btn-ghost btn-small">
              View trace page
            </Link>
          ) : null}
          <BatchPublicToggle batchId={b.id} isPublic={b.isPublic} />
        </div>
      </div>

      <div className={st.grid2}>
        <div>
          <section className={st.panel}>
            <div className={st.panelHead}>
              <h2>Trace events</h2>
              <EventDialog batchId={b.id} />
            </div>
            <ol role="list" className={st.feed}>
              {b.events.map((e) => (
                <li key={e.id}>
                  <span>
                    <strong>{STAGE_LABEL[e.stage]}</strong> — {e.title}
                    {!e.isPublic ? <span className={st.muted}> (private)</span> : null}
                    {e.publicDescription ? <div className={st.muted}>{e.publicDescription}</div> : null}
                    {e.privateNotes ? <div className={st.muted}>Note: {e.privateNotes}</div> : null}
                  </span>
                  <time>{fmtDate(e.occurredAt, { day: "numeric", month: "short", year: "numeric" })}</time>
                </li>
              ))}
            </ol>
          </section>
          <section className={st.panel}>
            <div className={st.panelHead}>
              <h2>Processing runs</h2>
              <RunDialog batchId={b.id} />
            </div>
            <table className={st.table}>
              <tbody>
                {b.processingRuns.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.process}
                      <div className={st.muted}>
                        {r.code} · {r.location?.name ?? "—"}
                      </div>
                    </td>
                    <td className={st.num}>
                      {fmtKg(r.inputGrams / 1000)} → {fmtKg(r.outputGrams != null ? r.outputGrams / 1000 : null)}
                    </td>
                    <td>{fmtDate(r.startedAt, { day: "numeric", month: "short" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
        <div>
          <section className={st.panel}>
            <div className={st.panelHead}>
              <h2>Summary</h2>
            </div>
            <dl className={st.kv}>
              <div>
                <dt>Centre</dt>
                <dd>{b.collectionCenter ? `${b.collectionCenter.code} · ${b.collectionCenter.name}` : "—"}</dd>
              </div>
              <div>
                <dt>Origin</dt>
                <dd>{b.originDistrict ?? "—"}</dd>
              </div>
              <div>
                <dt>Harvest</dt>
                <dd>{fmtDate(b.harvestDate)}</dd>
              </div>
              <div>
                <dt>Accepted input</dt>
                <dd>{fmtKg(b.inputGrams ? b.inputGrams / 1000 : null)}</dd>
              </div>
              <div>
                <dt>Output</dt>
                <dd>{fmtKg(b.outputGrams ? b.outputGrams / 1000 : null)}</dd>
              </div>
              <div>
                <dt>Packs</dt>
                <dd>{b.unitsPacked ?? "—"}</dd>
              </div>
              <div>
                <dt>Product</dt>
                <dd>{b.product ? <Link href={`/studio/products/${b.product.id}`}>{b.product.name}</Link> : "—"}</dd>
              </div>
            </dl>
          </section>
          <section className={st.panel}>
            <div className={st.panelHead}>
              <h2>Receipts in this batch</h2>
            </div>
            <table className={st.table}>
              <tbody>
                {b.receiptLinks.map(({ receipt: r }) => (
                  <tr key={r.id}>
                    <td className="code">{r.receiptNo}</td>
                    <td>{r.farmer.fullName}</td>
                    <td className={st.num}>{fmtKg((r.inspections.at(-1)?.acceptedGrams ?? 0) / 1000)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className={st.panel}>
            <div className={st.panelHead}>
              <h2>Quality checks</h2>
              <TestDialog batchId={b.id} documents={docs} />
            </div>
            {b.qualityTests.length ? (
              <table className={st.table}>
                <tbody>
                  {b.qualityTests.map((t) => (
                    <tr key={t.id}>
                      <td>
                        {t.testType}
                        <div className={st.muted}>{t.performedBy}</div>
                      </td>
                      <td className={st.num}>
                        {t.resultValue != null ? Number(t.resultValue) : "—"}
                        {t.resultUnit} <span className={st.muted}>{t.limitText}</span>
                      </td>
                      <td>
                        <span className={st.status} data-tone={t.passed ? "ok" : "bad"}>
                          {t.passed ? "within" : "outside"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className={st.empty}>No checks recorded.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
