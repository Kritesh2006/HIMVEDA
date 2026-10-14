import Link from "next/link";
import { getOverview } from "@/server/ops/admin";
import { getEditorSession } from "@/server/auth/session";
import { getContent } from "@/server/content/service";
import { EditSiteButton } from "@/components/studio/EditSiteButton";
import { fmtDate } from "@/lib/format";
import st from "@/components/studio/studio.module.css";

export const metadata = { title: "Overview" };

export default async function Overview() {
  const [o, s, c] = await Promise.all([getOverview(), getEditorSession(), getContent()]);
  const rows = [
    { n: o.toInspect, label: "deliveries waiting for inspection", href: "/studio/collection?status=received", go: "Inspect" },
    { n: o.toProcure, label: "accepted deliveries to procure", href: "/studio/collection?status=accepted", go: "Procure" },
    { n: o.pendingPayments, label: "producer payments not yet marked paid", href: "/studio/collection?view=payments", go: "Review" },
    { n: o.pendingApprovals, label: "procurement rate changes awaiting a second approval", href: "/studio/pricing", go: "Review" },
    { n: o.openOrders, label: "open order requests", href: "/studio/orders", go: "Open" },
    { n: o.lowStock, label: "product sizes with fewer than 10 in stock", href: "/studio/inventory", go: "Restock" },
    { n: o.drafts, label: "products in draft or with unpublished changes", href: "/studio/products?status=draft", go: "Review" },
    { n: o.unreadMessages, label: "contact messages not yet handled", href: "/studio/orders?view=messages", go: "Read" },
  ];
  return (
    <>
      <div className={st.pageHead}>
        <div>
          <h1>Overview</h1>
          <p>
            Signed in as {s?.displayName}. {fmtDate(new Date(), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.
          </p>
        </div>
        <div className={st.pageActions}>
          <Link href="/studio/products/new" className="btn btn-small">
            + Add product
          </Link>
          <Link href="/studio/collection" className="btn btn-ghost btn-small">
            Record a delivery
          </Link>
          <EditSiteButton className="btn btn-ghost btn-small" />
        </div>
      </div>

      {c["settings.demoMode"] ? (
        <div className={st.panel} style={{ marginBottom: 18, borderLeft: "3px solid var(--soil)" }}>
          <strong>Demonstration mode is on.</strong> <span className={st.muted}>The public site shows a sample-data notice and labels sample records. Turn it off and remove sample data in </span>
          <Link href="/studio/settings">Settings</Link>
          <span className={st.muted}> once real products are ready.</span>
        </div>
      ) : null}

      <div className={st.grid2}>
        <section className={st.panel} aria-labelledby="attn">
          <div className={st.panelHead}>
            <h2 id="attn">Needs attention</h2>
          </div>
          <div className={st.attention}>
            {rows.map((r) =>
              r.n ? (
                <Link key={r.label} href={r.href}>
                  <span className={st.attnN}>{r.n}</span>
                  <span>{r.label}</span>
                  <span className={st.attnGo}>{r.go}</span>
                </Link>
              ) : (
                <div key={r.label}>
                  <span className={st.attnN} data-zero="">
                    0
                  </span>
                  <span className={st.muted}>{r.label}</span>
                  <span />
                </div>
              ),
            )}
          </div>
        </section>

        <div>
          <section className={st.panel} aria-labelledby="sec">
            <div className={st.panelHead}>
              <h2 id="sec">Access security</h2>
              <Link href="/studio/users" className="small">
                Sessions
              </Link>
            </div>
            <p className="small">
              <strong>{o.failedAccess}</strong> failed access attempt{o.failedAccess === 1 ? "" : "s"} in the last 24 hours.{" "}
              <span className={st.muted}>
                All sign-ins pause automatically at {o.lockdownAt}. Per-device lockouts start after 5 failures.
              </span>
            </p>
          </section>
          <section className={st.panel} aria-labelledby="act">
            <div className={st.panelHead}>
              <h2 id="act">Recent activity</h2>
              <Link href="/studio/audit" className="small">
                Audit log
              </Link>
            </div>
            <ol role="list" className={st.feed}>
              {o.recent.map((a) => (
                <li key={a.id}>
                  <span>{a.summary}</span>
                  <time dateTime={a.createdAt.toISOString()}>{fmtDate(a.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
