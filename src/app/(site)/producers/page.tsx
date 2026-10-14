import type { Metadata } from "next";
import Link from "next/link";
import { Editable } from "@/components/edit/Editable";
import { NepalMap } from "@/components/geo/NepalMap";
import { listPublicCenters } from "@/server/trace/queries";
import s from "@/components/page/page.module.css";

export const metadata: Metadata = {
  title: "For producers",
  description: "How delivering to a HIMVEDA collection centre works: weighing, inspection, approved rates and payment records.",
  alternates: { canonical: "/producers" },
};

const STEPS = [
  ["Bring your produce to a collection centre", "Deliver to the nearest HIMVEDA collection centre. You are registered once, with your district and an approximate farm location — never your exact address on anything public."],
  ["It is weighed in front of you", "Gross weight, sack weight and net weight are written on a numbered receipt that you keep."],
  ["It is inspected before it is bought", "Moisture, foreign matter and grade are recorded. If something is held back, the reason is written down."],
  ["You are paid at the approved rate", "Each centre has an approved rate per kilogram for each commodity. Rate changes need a second person’s approval, so rates can’t change quietly."],
  ["Your payment is recorded against the receipt", "Every payment is linked to the receipt it pays for, so both sides can check what was delivered and what was paid."],
];

export default async function ProducersPage() {
  const centers = await listPublicCenters();
  return (
    <div className={`wrap ${s.page}`}>
      <header className={s.head}>
        <p className="margin-note">For producers</p>
        <h1 className="display">
          <Editable k="producers.title" />
        </h1>
        <Editable k="producers.body" as="p" className="lede" multiline />
      </header>

      <ol role="list" className={s.steps}>
        {STEPS.map(([title, body], i) => (
          <li key={title}>
            <span className={s.stepNo}>{String(i + 1).padStart(2, "0")}</span>
            <h2 className={s.stepTitle}>{title}</h2>
            <p className={s.stepBody}>{body}</p>
          </li>
        ))}
      </ol>

      {centers.length ? (
        <section className={s.twoCol} style={{ marginTop: "clamp(56px, 8vw, 120px)" }} aria-labelledby="centres-title">
          <div style={{ display: "grid", gap: 16 }}>
            <h2 id="centres-title" className="h1">
              Collection centres
            </h2>
            <ul role="list" className={s.contactList}>
              {centers.map((c) => (
                <li key={c.code} style={{ padding: "14px 0", borderBottom: "1px solid var(--line)" }}>
                  <strong className="code">{c.code}</strong> {c.name}
                  <span className="muted"> — {c.district}{c.province ? `, ${c.province}` : ""}</span>
                </li>
              ))}
            </ul>
            <Link href="/contact?topic=producer" className="btn" style={{ justifySelf: "start" }}>
              Ask about delivering
            </Link>
          </div>
          <NepalMap
            title="Collection centres"
            draw="view"
            nodes={centers.filter((c) => c.lat && c.lng).map((c) => ({ lat: Number(c.lat), lng: Number(c.lng), kind: "center" as const, label: c.code }))}
          />
        </section>
      ) : null}
    </div>
  );
}
