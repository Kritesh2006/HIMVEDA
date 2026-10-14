import { getPricing } from "@/server/ops/admin";
import { getEditorSession } from "@/server/auth/session";
import { CURRENCIES, formatMoney } from "@/lib/currency/config";
import { DEV_RATE_SOURCE } from "@/server/currency/dev-rates";
import { convertFromNpr } from "@/server/currency/pricing";
import { DecideButtons, NewRateDialog, ProposeRateDialog, RefreshFx, RoundingSelect } from "@/components/studio/forms";
import { fmtDate } from "@/lib/format";
import st from "@/components/studio/studio.module.css";

export const metadata = { title: "Pricing" };

export default async function PricingPage() {
  const [{ rates, rules, approvals, centers }, session] = await Promise.all([getPricing(), getEditorSession()]);
  const rounding = Object.fromEntries(rules.filter((r) => r.kind === "display_rounding" && r.currency).map((r) => [r.currency!, r.rounding]));
  const procurement = rules.filter((r) => r.kind === "procurement_rate");
  const usingDev = rates.some((r) => r.source === DEV_RATE_SOURCE);
  const pending = approvals.filter((a) => a.status === "pending");
  return (
    <>
      <div className={st.pageHead}>
        <div>
          <h1>Pricing</h1>
          <p>Retail prices are set per product in NPR. This page controls how they convert for visitors, and the approved rates paid to producers.</p>
        </div>
      </div>

      {pending.length ? (
        <section className={st.panel} style={{ marginBottom: 18, borderLeft: "3px solid var(--marigold)" }}>
          <div className={st.panelHead}>
            <h2>Waiting for approval</h2>
            <p>A different editor from the one who proposed it must approve.</p>
          </div>
          <table className={st.table}>
            <tbody>
              {pending.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.pricingRule.name}</strong>
                    {a.isDemo ? (
                      <>
                        {" "}
                        <span className="tag tag-sample">Sample</span>
                      </>
                    ) : null}
                    {a.note ? <div className={st.muted}>{a.note}</div> : null}
                  </td>
                  <td className={st.num}>
                    {a.previousMinor != null ? formatMoney(a.previousMinor, "NPR") : "new"} → <strong>{formatMoney(a.proposedMinor, "NPR")}</strong> / kg
                  </td>
                  <td>{a.requestedById === session?.userId ? <span className={st.muted}>Proposed by you</span> : <DecideButtons approvalId={a.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <div className={st.grid2}>
        <section className={st.panel}>
          <div className={st.panelHead}>
            <h2>Exchange rates & display</h2>
            <RefreshFx />
          </div>
          {usingDev ? (
            <p className="small" style={{ marginBottom: 12 }}>
              <span className={st.status} data-tone="warn">
                Development rates
              </span>{" "}
              Set <code>FX_PROVIDER</code> and <code>FX_API_KEY</code> to use live rates. Converted prices are always shown with “≈”.
            </p>
          ) : null}
          <div className={st.tableWrap}>
            <table className={st.table}>
              <thead>
                <tr>
                  <th scope="col">Currency</th>
                  <th scope="col" className={st.num}>
                    रू 1,000 =
                  </th>
                  <th scope="col">Source</th>
                  <th scope="col">Rounding</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>NPR</strong> <span className={st.muted}>base</span>
                  </td>
                  <td className={st.num}>रू 1,000</td>
                  <td>—</td>
                  <td>
                    <RoundingSelect currency="NPR" value={rounding.NPR ?? "whole"} />
                  </td>
                </tr>
                {CURRENCIES.filter((c) => c.code !== "NPR").map((c) => {
                  const r = rates.find((x) => x.currency === c.code);
                  return (
                    <tr key={c.code}>
                      <td>
                        <strong>{c.code}</strong> <span className={st.muted}>{c.region}</span>
                      </td>
                      <td className={st.num}>{r ? formatMoney(convertFromNpr(100000, c.code, Number(r.ratePerNpr)), c.code) : "—"}</td>
                      <td className={st.muted}>{r ? `${r.source === DEV_RATE_SOURCE ? "development" : r.source}, ${fmtDate(r.fetchedAt, { day: "numeric", month: "short" })}` : "missing"}</td>
                      <td>
                        <RoundingSelect currency={c.code} value={rounding[c.code] ?? "none"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className={st.panel}>
          <div className={st.panelHead}>
            <h2>Procurement rates</h2>
            <NewRateDialog centers={centers.map((c) => ({ id: c.id, label: `${c.code} · ${c.name}` }))} />
          </div>
          <p className="small muted" style={{ marginBottom: 10 }}>
            Paid to producers per kg of accepted weight. Grade B pays 90%, grade C 80%.
          </p>
          <table className={st.table}>
            <tbody>
              {procurement.map((r) => (
                <tr key={r.id}>
                  <td className={st.wrap}>
                    {r.commodity} <span className={st.muted}>· {r.collectionCenter?.code}</span>
                    {!r.active ? (
                      <>
                        {" "}
                        <span className={st.status} data-tone="warn">
                          Awaiting approval
                        </span>
                      </>
                    ) : null}
                  </td>
                  <td className={st.num}>{r.ratePerKgMinor != null ? formatMoney(r.ratePerKgMinor, "NPR") : "—"}</td>
                  <td>{r.active ? <ProposeRateDialog ruleId={r.id} name={r.name} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {approvals.some((a) => a.status !== "pending") ? (
            <>
              <h3 className="label" style={{ margin: "18px 0 6px" }}>
                Decisions
              </h3>
              <ol role="list" className={st.feed}>
                {approvals
                  .filter((a) => a.status !== "pending")
                  .slice(0, 8)
                  .map((a) => (
                    <li key={a.id}>
                      <span>
                        {a.pricingRule.name}: {a.status} {formatMoney(a.proposedMinor, "NPR")}
                      </span>
                      <time>{fmtDate(a.decidedAt, { day: "numeric", month: "short" })}</time>
                    </li>
                  ))}
              </ol>
            </>
          ) : null}
        </section>
      </div>
    </>
  );
}
