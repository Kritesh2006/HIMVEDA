import type { Metadata } from "next";
import Link from "next/link";
import { getPublicTrace, BATCH_CODE } from "@/server/trace/queries";
import { getContent } from "@/server/content/service";
import { NepalMap, type MapNode } from "@/components/geo/NepalMap";
import { TraceLookup } from "@/components/trace/TraceLookup";
import { STAGE_LABEL, METRIC_LABEL, fmtDate, fmtInt, fmtKg, fmtMetric } from "@/lib/format";
import s from "@/components/trace/trace.module.css";

type Params = Promise<{ code: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { code } = await params;
  const t = await getPublicTrace(decodeURIComponent(code));
  if (!t) return { title: "Batch not found", robots: { index: false } };
  return {
    title: `Batch ${t.code} · ${t.commodity}`,
    description: `${t.commodity} from ${t.originDistrict ?? "Nepal"}: collection, inspection, processing and availability on record.`,
    alternates: { canonical: `/trace/${t.code}` },
  };
}

const JOURNEY = ["origin", "collected", "inspected", "verified", "processed", "packaged", "available"] as const;

export default async function TracePage({ params }: { params: Params }) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw).toUpperCase();
  const [t, c] = await Promise.all([getPublicTrace(code), getContent()]);

  if (!t) {
    const valid = BATCH_CODE.test(code);
    return (
      <div className={`wrap ${s.missing}`}>
        <svg viewBox="0 0 200 60" aria-hidden="true" className={s.missingArt}>
          <path d="M6 50 C 40 48, 60 14, 100 14" fill="none" stroke="var(--marigold)" strokeWidth="2" />
          <path d="M100 14 C 140 14, 160 44, 194 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 6" />
          <circle cx="100" cy="14" r="5" fill="var(--marigold)" />
        </svg>
        <h1 className="h1">{valid ? `No published batch ${code}.` : "That doesn’t look like a batch code."}</h1>
        <p className="lede">
          {valid
            ? "Check the code on the pack — it may be mistyped, or the batch may not have been published yet."
            : "Batch codes have four parts, like HIM-26-KTM-00482."}
        </p>
        <div className={s.indexForm}>
          <TraceLookup placeholder="HIM-26-KTM-00482" initial={valid ? code : ""} />
        </div>
      </div>
    );
  }

  const ev = (stage: string) => t.events.find((e) => e.stage === stage);
  const nodes: MapNode[] = [];
  const route: { lat: number; lng: number }[] = [];
  if (t.origin) {
    route.push(t.origin);
    nodes.push({ ...t.origin, kind: "origin", marker: "1", label: `${t.originDistrict ?? "Origin"}, approximate origin` });
  }
  if (t.center?.lat && t.center.lng) {
    route.push({ lat: t.center.lat, lng: t.center.lng });
    nodes.push({ lat: t.center.lat, lng: t.center.lng, kind: "center", marker: String(nodes.length + 1), label: t.center.name });
  }
  const proc = ev("processed");
  if (proc?.lat && proc.lng) {
    route.push({ lat: proc.lat, lng: proc.lng });
    nodes.push({ lat: proc.lat, lng: proc.lng, kind: "market", marker: String(nodes.length + 1), label: proc.location ? `Processing, ${proc.location}` : "Processing" });
  }
  const reached = new Set(t.events.map((e) => e.stage));
  const demo = c["settings.demoMode"] && t.isDemo;
  const yieldPct = t.inputKg && t.outputKg ? Math.round((t.outputKg / t.inputKg) * 1000) / 10 : null;

  return (
    <article className={s.trace}>
      <header className={`on-forest ${s.head}`}>
        <div className={`wrap ${s.headGrid}`}>
          <div>
            <p className={s.headKicker}>
              Batch record
              {demo ? <span className="tag tag-sample">Sample data</span> : null}
            </p>
            <h1 className={`code ${s.code}`}>{t.code}</h1>
            <p className={s.commodity}>{t.commodity}</p>
            {t.publicSummary ? <p className={s.summary}>{t.publicSummary}</p> : null}
          </div>
          <ol role="list" className={s.rail} aria-label="Checkpoints">
            {JOURNEY.map((st) => (
              <li key={st} data-done={reached.has(st) || undefined}>
                <span aria-hidden="true" />
                {STAGE_LABEL[st]}
                <span className="sr-only">{reached.has(st) ? " — recorded" : " — not yet recorded"}</span>
              </li>
            ))}
          </ol>
        </div>
      </header>

      <div className={`wrap ${s.body}`}>
        <aside className={s.facts} aria-label="Batch facts">
          <NepalMap nodes={nodes} route={route} draw="view" title={`Route of batch ${t.code} across Nepal`} className={s.map} fit labelScale={2.2} />
          {nodes.length ? (
            <ol role="list" className={s.legend}>
              {nodes.map((n) => (
                <li key={n.marker}>
                  <span data-kind={n.kind}>{n.marker}</span>
                  {n.label}
                </li>
              ))}
            </ol>
          ) : null}
          <dl>
            <div>
              <dt>Origin</dt>
              <dd>{t.originDistrict ?? "—"}</dd>
            </div>
            <div>
              <dt>Harvest</dt>
              <dd>{fmtDate(t.harvestDate)}</dd>
            </div>
            <div>
              <dt>Producers</dt>
              <dd>{fmtInt(t.producerCount)}</dd>
            </div>
            <div>
              <dt>Grade</dt>
              <dd>{t.qualityGrade === "ungraded" ? "Not graded" : t.qualityGrade}</dd>
            </div>
            <div>
              <dt>Into processing</dt>
              <dd className="num">{fmtKg(t.inputKg)}</dd>
            </div>
            <div>
              <dt>Out of processing</dt>
              <dd className="num">
                {fmtKg(t.outputKg)}
                {yieldPct ? <span className="muted"> · {yieldPct}%</span> : null}
              </dd>
            </div>
            <div>
              <dt>Packs</dt>
              <dd className="num">{fmtInt(t.unitsPacked)}</dd>
            </div>
          </dl>
          {t.product ? (
            <Link href={`/products/${t.product.slug}`} className="btn btn-block" data-magnetic>
              Buy {t.product.name}
            </Link>
          ) : null}
        </aside>

        <section className={s.timelineWrap} aria-labelledby="journey-title">
          <h2 id="journey-title" className="h2">
            Journey
          </h2>
          <ol role="list" className={s.timeline}>
            {t.events.map((e, i) => (
              <li key={`${e.stage}-${i}`} className={s.event} data-inview="" style={{ ["--e" as string]: i }}>
                <div className={s.eventMark} aria-hidden="true" />
                <div className={s.eventHead}>
                  <span className={s.eventStage}>{STAGE_LABEL[e.stage]}</span>
                  <time dateTime={e.occurredAt}>{fmtDate(e.occurredAt)}</time>
                </div>
                <h3 className={s.eventTitle}>{e.title}</h3>
                {e.description ? <p className={s.eventBody}>{e.description}</p> : null}
                {e.location ? <p className={s.eventWhere}>{e.location}</p> : null}
                {Object.keys(e.metrics).length ? (
                  <dl className={s.metrics}>
                    {Object.entries(e.metrics).map(([k, v]) => (
                      <div key={k}>
                        <dt>{METRIC_LABEL[k] ?? k}</dt>
                        <dd className="num">{fmtMetric(k, v)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </li>
            ))}
          </ol>

          <section className={s.checks} aria-labelledby="checks-title">
            <h2 id="checks-title" className="h3">
              Checks on record
            </h2>
            {t.tests.length ? (
              <table className={s.checkTable}>
                <thead>
                  <tr>
                    <th scope="col">Check</th>
                    <th scope="col">Result</th>
                    <th scope="col">Limit</th>
                    <th scope="col">By</th>
                  </tr>
                </thead>
                <tbody>
                  {t.tests.map((x) => (
                    <tr key={x.testType}>
                      <th scope="row">
                        {x.testType}
                        {x.method ? <span className={s.method}>{x.method}</span> : null}
                      </th>
                      <td className="num">
                        <span className={s.pass} data-pass={x.passed || undefined}>
                          {x.passed ? "Within limit" : "Outside limit"}
                        </span>{" "}
                        {x.value}
                        {x.unit}
                      </td>
                      <td>{x.limit ?? "—"}</td>
                      <td>
                        {x.performedBy ?? "—"}
                        {x.documentId ? (
                          <>
                            {" "}
                            <a href={`/api/media/${x.documentId}`}>Report</a>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">Only the inspection results above are on record for this batch.</p>
            )}
            {!t.tests.some((x) => x.documentId) ? (
              <p className={s.honest}>No laboratory certificate is on file for this batch, so none is shown.</p>
            ) : null}
          </section>

          <section className={s.private} aria-labelledby="private-title">
            <h2 id="private-title" className="h3">
              What this page leaves out
            </h2>
            <p className="muted">
              Producers’ names and contact details, exact farm locations, and the prices paid to producers are kept private.
              Origin is shown to roughly 10 km.
            </p>
          </section>
        </section>
      </div>
    </article>
  );
}
