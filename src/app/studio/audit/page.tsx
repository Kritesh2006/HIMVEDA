import Link from "next/link";
import { listAudit } from "@/server/ops/admin";
import { fmtDate } from "@/lib/format";
import st from "@/components/studio/studio.module.css";

export const metadata = { title: "Audit log" };

type SP = Promise<Record<string, string | undefined>>;
const ENTITIES = ["product", "content", "variant", "receipt", "batch", "pricing_rule", "order", "user", "session", "security", "media"];

export default async function AuditPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total, pages } = await listAudit({ q: sp.q?.slice(0, 80), entity: ENTITIES.includes(sp.entity ?? "") ? sp.entity : undefined, page });
  const qs = (p: number) => `/studio/audit?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.entity ? { entity: sp.entity } : {}), page: String(p) })}`;
  return (
    <>
      <div className={st.pageHead}>
        <div>
          <h1>Audit log</h1>
          <p>Every change made in Studio: who, what, the previous and new value, and when. Entries can’t be edited or deleted.</p>
        </div>
      </div>
      <form className={st.inline} style={{ marginBottom: 14 }} role="search">
        <input name="q" className="input" defaultValue={sp.q} placeholder="Search changes or editor" aria-label="Search" style={{ width: 280 }} />
        <select name="entity" className="select" defaultValue={sp.entity ?? ""} aria-label="Type">
          <option value="">All types</option>
          {ENTITIES.map((e) => (
            <option key={e} value={e}>
              {e.replace("_", " ")}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-ghost btn-small">
          Filter
        </button>
        <span className="small muted">{total} entries</span>
      </form>
      <div className={st.panel}>
        <div className={st.tableWrap}>
          <table className={st.table}>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Who</th>
                <th scope="col">Change</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.createdAt, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                  <td>{r.actorLabel}</td>
                  <td className={st.wrap}>
                    {r.summary}
                    <div className={st.muted}>{r.action}</div>
                  </td>
                  <td>
                    {r.before || r.after ? (
                      <details>
                        <summary className="small">Before / after</summary>
                        <pre style={{ fontSize: 12, whiteSpace: "pre-wrap", maxWidth: 520, maxHeight: 280, overflow: "auto" }}>
                          {JSON.stringify({ before: r.before, after: r.after }, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={st.inline} style={{ marginTop: 14 }}>
          {page > 1 ? (
            <Link href={qs(page - 1)} className="btn btn-ghost btn-small">
              Newer
            </Link>
          ) : null}
          <span className="small muted">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={qs(page + 1)} className="btn btn-ghost btn-small">
              Older
            </Link>
          ) : null}
        </div>
      </div>
    </>
  );
}
