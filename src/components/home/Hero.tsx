import Link from "next/link";
import { NepalMap, type MapNode } from "@/components/geo/NepalMap";
import { Editable, EditableLink } from "@/components/edit/Editable";
import type { PublicTrace } from "@/server/trace/queries";
import { fmtDate, fmtKg } from "@/lib/format";
import s from "./home.module.css";

type Center = { code: string; name: string; district: string; lat: string | null; lng: string | null };

const TAG_STAGES = [
  ["origin", "Field"],
  ["collected", "Collected"],
  ["verified", "Verified"],
  ["processed", "Processed"],
  ["available", "Market"],
] as const;

export function Hero({ trace, centers, showSample }: { trace: PublicTrace | null; centers: Center[]; showSample: boolean }) {
  const nodes: MapNode[] = [];
  const route: { lat: number; lng: number }[] = [];
  if (trace) {
    for (const c of centers) {
      if (c.code === trace.center?.code || !c.lat || !c.lng) continue;
      nodes.push({ lat: Number(c.lat), lng: Number(c.lng), kind: "center" });
    }
    if (trace.origin) {
      route.push(trace.origin);
      nodes.push({ ...trace.origin, kind: "origin" });
    }
    if (trace.center?.lat && trace.center.lng) {
      route.push({ lat: trace.center.lat, lng: trace.center.lng });
      nodes.push({ lat: trace.center.lat, lng: trace.center.lng, kind: "center", label: trace.center.district, sub: "harvest & collection" });
    }
    const proc = trace.events.find((e) => e.stage === "processed" && e.lat && e.lng);
    if (proc?.lat && proc.lng) {
      route.push({ lat: proc.lat, lng: proc.lng });
      nodes.push({ lat: proc.lat, lng: proc.lng, kind: "market", label: "Kathmandu", sub: "processing & market", align: "below" });
    }
  }

  const reached = new Set(trace?.events.map((e) => e.stage));
  const accepted = trace?.events.find((e) => e.stage === "verified")?.metrics.acceptedKg;

  return (
    <section className={s.hero} aria-label="Introduction">
      <div className={`wrap ${s.heroStage}`}>
        <NepalMap
          className={s.heroMap}
          nodes={nodes}
          route={route}
          draw="load"
          title={trace ? `Map of Nepal showing batch ${trace.code} travelling from ${trace.originDistrict} to Kathmandu` : "Map of Nepal"}
        />

        <div className={s.heroCopy}>
          <Editable k="home.hero.title" as="h1" className={`display ${s.heroTitle}`} />
          <Editable k="home.hero.lede" as="p" className={`lede ${s.heroLede}`} multiline />
          <div className={s.heroActions}>
            <EditableLink k="home.hero.primary" className="btn" magnetic />
            <EditableLink k="home.hero.secondary" className="btn btn-ghost" magnetic />
          </div>
        </div>

        {trace ? (
          <aside className={s.tag} aria-label={`Featured batch ${trace.code}`}>
            <span className={s.tagHole} aria-hidden="true" />
            <div className={s.tagHead}>
              <span className={s.tagLabel}>Batch</span>
              {showSample && trace.isDemo ? <span className="tag tag-sample">Sample</span> : null}
            </div>
            <p className={`code ${s.tagCode}`}>{trace.code}</p>
            <p className={s.tagCommodity}>{trace.commodity}</p>
            <ol className={s.tagStages} role="list" aria-label="Checkpoints passed">
              {TAG_STAGES.map(([st, label]) => (
                <li key={st} data-done={reached.has(st) || undefined}>
                  <span aria-hidden="true" />
                  {label}
                  <span className="sr-only">{reached.has(st) ? ", recorded" : ", not yet"}</span>
                </li>
              ))}
            </ol>
            <dl className={s.tagFacts}>
              <div>
                <dt>Origin</dt>
                <dd>{trace.originDistrict}</dd>
              </div>
              <div>
                <dt>Harvest</dt>
                <dd>{fmtDate(trace.harvestDate, { month: "short", year: "numeric" })}</dd>
              </div>
              <div>
                <dt>Accepted</dt>
                <dd className="num">{typeof accepted === "number" ? fmtKg(accepted) : "—"}</dd>
              </div>
              <div>
                <dt>Grade</dt>
                <dd>{trace.qualityGrade === "ungraded" ? "—" : trace.qualityGrade}</dd>
              </div>
            </dl>
            <Link href={`/trace/${trace.code}`} className={s.tagLink}>
              Follow this batch
            </Link>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
