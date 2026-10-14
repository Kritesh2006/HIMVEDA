import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { fmtDate, fmtKg } from "@/lib/format";
import st from "@/components/studio/studio.module.css";

export const metadata = { title: "Quality" };

export default async function QualityPage() {
  const [inspections, tests] = await Promise.all([
    db.query.inspections.findMany({ orderBy: [desc(schema.inspections.inspectedAt)], limit: 100, with: { receipt: { columns: { receiptNo: true, commodity: true, netGrams: true } } } }),
    db.query.qualityTests.findMany({ orderBy: [desc(schema.qualityTests.testedAt)], limit: 100, with: { batch: { columns: { id: true, code: true } } } }),
  ]);
  const passRate = inspections.length ? Math.round((inspections.filter((i) => i.result === "pass").length / inspections.length) * 100) : null;
  return (
    <>
      <div className={st.pageHead}>
        <div>
          <h1>Quality</h1>
          <p>
            Inspections at collection and checks on batches. Laboratory results are recorded only with the lab named and, where public, the report attached.
            {passRate != null ? ` ${passRate}% of inspections passed.` : ""}
          </p>
        </div>
      </div>
      <div className={st.grid2}>
        <section className={st.panel}>
          <div className={st.panelHead}>
            <h2>Inspections</h2>
            <Link href="/studio/collection?status=received" className="small">
              Inspect deliveries
            </Link>
          </div>
          <div className={st.tableWrap}>
            <table className={st.table}>
              <thead>
                <tr>
                  <th scope="col">Receipt</th>
                  <th scope="col">Result</th>
                  <th scope="col">Grade</th>
                  <th scope="col" className={st.num}>
                    Moisture
                  </th>
                  <th scope="col" className={st.num}>
                    Foreign
                  </th>
                  <th scope="col" className={st.num}>
                    Accepted
                  </th>
                </tr>
              </thead>
              <tbody>
                {inspections.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <span className="code">{i.receipt.receiptNo}</span>
                      <div className={st.muted}>
                        {i.receipt.commodity} · {fmtDate(i.inspectedAt, { day: "numeric", month: "short" })}
                      </div>
                    </td>
                    <td>
                      <span className={st.status} data-tone={i.result === "pass" ? "ok" : i.result === "fail" ? "bad" : "warn"}>
                        {i.result}
                      </span>
                    </td>
                    <td>{i.visualGrade}</td>
                    <td className={st.num}>{i.moisturePct ? `${Number(i.moisturePct)}%` : "—"}</td>
                    <td className={st.num}>{i.foreignMatterPct ? `${Number(i.foreignMatterPct)}%` : "—"}</td>
                    <td className={st.num}>{fmtKg((i.acceptedGrams ?? 0) / 1000)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className={st.panel}>
          <div className={st.panelHead}>
            <h2>Batch checks</h2>
            <p>Add checks from a batch’s page.</p>
          </div>
          <table className={st.table}>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/studio/traceability/${t.batch.id}`} className="code">
                      {t.batch.code}
                    </Link>
                    <div className={st.muted}>
                      {t.testType} · {t.performedBy}
                    </div>
                  </td>
                  <td className={st.num}>
                    {t.resultValue != null ? Number(t.resultValue) : "—"}
                    {t.resultUnit}
                    <div className={st.muted}>{t.limitText}</div>
                  </td>
                  <td>
                    <span className={st.status} data-tone={t.passed ? "ok" : "bad"}>
                      {t.passed ? "within" : "outside"}
                    </span>
                    {t.documentMediaId ? <div className={st.muted}>report attached</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
