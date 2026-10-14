import Link from "next/link";
import { listBatches } from "@/server/ops/agri";
import { STAGE_LABEL, fmtDate, fmtKg } from "@/lib/format";
import st from "@/components/studio/studio.module.css";

export const metadata = { title: "Traceability" };

export default async function TracePage() {
  const batches = await listBatches();
  return (
    <>
      <div className={st.pageHead}>
        <div>
          <h1>Traceability</h1>
          <p>Batches formed from procured deliveries. Each has a permanent code and a trace page that you publish when it’s ready.</p>
        </div>
        <div className={st.pageActions}>
          <Link href="/studio/traceability/new" className="btn btn-small">
            + Form a batch
          </Link>
        </div>
      </div>
      <div className={st.panel}>
        {batches.length ? (
          <div className={st.tableWrap}>
            <table className={st.table}>
              <thead>
                <tr>
                  <th scope="col">Batch</th>
                  <th scope="col">Commodity</th>
                  <th scope="col">Stage</th>
                  <th scope="col" className={st.num}>
                    In → out
                  </th>
                  <th scope="col">Product</th>
                  <th scope="col">Trace page</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link href={`/studio/traceability/${b.id}`} className={`${st.rowLink} code`}>
                        {b.code}
                      </Link>
                      {b.isDemo ? (
                        <>
                          {" "}
                          <span className="tag tag-sample">Sample</span>
                        </>
                      ) : null}
                      <div className={st.muted}>
                        {b.originDistrict} · harvest {fmtDate(b.harvestDate, { month: "short", year: "numeric" })}
                      </div>
                    </td>
                    <td>{b.commodity}</td>
                    <td>{STAGE_LABEL[b.stage]}</td>
                    <td className={st.num}>
                      {fmtKg(b.inputGrams ? b.inputGrams / 1000 : null)} → {fmtKg(b.outputGrams ? b.outputGrams / 1000 : null)}
                    </td>
                    <td>{b.product?.name ?? <span className={st.muted}>—</span>}</td>
                    <td>
                      {b.isPublic ? (
                        <Link href={`/trace/${b.code}`} target="_blank">
                          Public
                        </Link>
                      ) : (
                        <span className={st.status} data-tone="warn">
                          Hidden
                        </span>
                      )}
                      <span className={st.muted}>
                        {" "}
                        · {b.events.length} events, {b.qualityTests.length} checks
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={st.empty}>No batches yet. Procure some deliveries, then form a batch from them.</p>
        )}
      </div>
    </>
  );
}
