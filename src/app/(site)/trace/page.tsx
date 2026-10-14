import type { Metadata } from "next";
import Link from "next/link";
import { listPublicBatchCodes } from "@/server/trace/queries";
import { getContent } from "@/server/content/service";
import { TraceLookup } from "@/components/trace/TraceLookup";
import { STAGE_LABEL } from "@/lib/format";
import s from "@/components/trace/trace.module.css";

export const metadata: Metadata = {
  title: "Trace a batch",
  description: "Enter the batch code from a HIMVEDA pack to see where it came from and every checkpoint it passed.",
  alternates: { canonical: "/trace" },
};

export default async function TraceIndex() {
  const [codes, c] = await Promise.all([listPublicBatchCodes(12), getContent()]);
  return (
    <div className={`wrap ${s.index}`}>
      <div className={s.indexHead}>
        <h1 className="display">Trace a batch</h1>
        <p className="lede">
          Every HIMVEDA pack is printed with a batch code. Enter it to see the district it came from, where it was weighed and
          inspected, how it was processed, and when it reached the market.
        </p>
        <div className={s.indexForm}>
          <TraceLookup placeholder={codes[0]?.code ?? "HIM-26-KTM-00482"} />
        </div>
      </div>

      <section className={s.anatomy} aria-labelledby="anatomy-title">
        <h2 id="anatomy-title" className="h3">
          Reading a batch code
        </h2>
        <p className={`code ${s.anatomyCode}`} aria-label="HIM-26-KTM-00482">
          <span>HIM</span>
          <span>26</span>
          <span>KTM</span>
          <span>00482</span>
        </p>
        <ol role="list" className={s.anatomyParts}>
          <li>
            <strong>HIM</strong> HIMVEDA
          </li>
          <li>
            <strong>26</strong> Year the batch was formed
          </li>
          <li>
            <strong>KTM</strong> Collection centre where it originated
          </li>
          <li>
            <strong>00482</strong> Sequence number
          </li>
        </ol>
      </section>

      {codes.length ? (
        <section className={s.recent} aria-labelledby="recent-title">
          <h2 id="recent-title" className="h3">
            {c["settings.demoMode"] && codes.some((x) => x.isDemo) ? "Sample batches" : "Published batches"}
          </h2>
          <ul role="list">
            {codes.map((b) => (
              <li key={b.code}>
                <Link href={`/trace/${b.code}`}>
                  <span className="code">{b.code}</span>
                  <span>{b.commodity}</span>
                  <span className={s.recentStage}>{STAGE_LABEL[b.stage]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
