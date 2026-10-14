import Link from "next/link";
import { Editable } from "@/components/edit/Editable";
import { NepalMap } from "@/components/geo/NepalMap";
import { ProductCard } from "@/components/product/ProductCard";
import { MediaImage } from "@/components/product/MediaImage";
import { TraceLookup } from "@/components/trace/TraceLookup";
import type { ProductCard as Card } from "@/server/catalog/queries";
import type { PublicTrace } from "@/server/trace/queries";
import type { ContentMap } from "@/server/content/registry";
import { fmtDate, fmtInt, fmtKg } from "@/lib/format";
import s from "./home.module.css";

/* ── The system: one continuous line through four participants ── */
export function Ecosystem() {
  const parties = [
    { name: "Producers", note: "Grow and deliver" },
    { name: "Collection centres", note: "Weigh, inspect, receipt" },
    { name: "HIMVEDA", note: "Buy, process, batch" },
    { name: "Buyers", note: "Order with the record" },
  ];
  return (
    <section className={`section ${s.eco}`} aria-labelledby="eco-title">
      <div className="wrap margin-grid">
        <Editable k="home.ecosystem.kicker" as="p" className="margin-note" />
        <div>
          <h2 id="eco-title" className={`h1 ${s.ecoTitle}`}>
            <Editable k="home.ecosystem.title" />
          </h2>
          <Editable k="home.ecosystem.body" as="p" className={`body-serif ${s.ecoBody}`} multiline />
          <ol className={s.flow} role="list" data-inview="">
            {parties.map((p, i) => (
              <li key={p.name} style={{ ["--k" as string]: i }}>
                <span className={s.flowDot} aria-hidden="true" />
                <strong>{p.name}</strong>
                <span>{p.note}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ── Producers: a real receipt, as the producer receives it ── */
type Receipt = NonNullable<Awaited<ReturnType<typeof import("@/server/home/queries").getSpecimenReceipt>>>;

export function Producers({ receipt, showSample }: { receipt: Receipt | null; showSample: boolean }) {
  return (
    <section className={`section ${s.producers}`} aria-labelledby="producers-title">
      <div className={`wrap ${s.split}`}>
        <div className={s.splitText}>
          <Editable k="home.producers.kicker" as="p" className="margin-note" />
          <h2 id="producers-title" className="h1">
            <Editable k="home.producers.title" />
          </h2>
          <Editable k="home.producers.body" as="p" className="lede" multiline />
          <ul className={s.ticks} role="list">
            <li>Measured gross, tare and net weight</li>
            <li>Inspection result and grade, written down at the centre</li>
            <li>The approved rate for that centre and commodity</li>
            <li>A payment record linked to the receipt</li>
          </ul>
          <Link href="/producers" className="link">
            How collection works
          </Link>
        </div>
        {receipt ? (
          <figure className={s.receiptWrap}>
            <div className={s.receipt} aria-label={`Collection receipt ${receipt.receiptNo}`}>
              <div className={s.receiptHead}>
                <span className={s.receiptBrand}>HIMVEDA · Collection receipt</span>
                <span className="code">{receipt.receiptNo}</span>
              </div>
              <dl className={s.receiptGrid}>
                <div>
                  <dt>Centre</dt>
                  <dd>{receipt.center}</dd>
                </div>
                <div>
                  <dt>Received</dt>
                  <dd>{fmtDate(receipt.receivedAt)}</dd>
                </div>
                <div>
                  <dt>Producer</dt>
                  <dd className="code">{receipt.producer}</dd>
                </div>
                <div>
                  <dt>Commodity</dt>
                  <dd>{receipt.commodity}</dd>
                </div>
              </dl>
              <table className={s.receiptTable}>
                <caption className="sr-only">Weights</caption>
                <tbody>
                  <tr>
                    <th scope="row">Gross weight</th>
                    <td className="num">{fmtKg(receipt.grossKg)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Tare (sacks)</th>
                    <td className="num">− {fmtKg(receipt.tareKg)}</td>
                  </tr>
                  <tr className={s.receiptStrong}>
                    <th scope="row">Net weight</th>
                    <td className="num">{fmtKg(receipt.netKg)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Moisture</th>
                    <td className="num">{receipt.moisture != null ? `${receipt.moisture}%` : "—"}</td>
                  </tr>
                  <tr>
                    <th scope="row">Foreign matter</th>
                    <td className="num">{receipt.foreign != null ? `${receipt.foreign}%` : "—"}</td>
                  </tr>
                  <tr>
                    <th scope="row">Grade</th>
                    <td>{receipt.grade ?? "—"}</td>
                  </tr>
                  <tr className={s.receiptStrong}>
                    <th scope="row">Accepted</th>
                    <td className="num">{fmtKg(receipt.acceptedKg)}</td>
                  </tr>
                </tbody>
              </table>
              <div className={s.receiptFoot}>
                <span>{receipt.paid ? "Payment recorded" : "Payment approved"}</span>
                <span className={s.stamp} aria-hidden="true">
                  {receipt.result === "pass" ? "Accepted" : "Held"}
                </span>
              </div>
            </div>
            <figcaption className="small muted">
              {showSample && receipt.isDemo ? "A sample receipt from the demonstration data. " : ""}Amounts paid are private to the producer
              and never published.
            </figcaption>
          </figure>
        ) : null}
      </div>
    </section>
  );
}

/* ── Network ── */
type Center = { code: string; name: string; district: string; province: string | null; lat: string | null; lng: string | null; isDemo: boolean };

export function Network({ centers, showSample }: { centers: Center[]; showSample: boolean }) {
  const nodes = centers
    .filter((c) => c.lat && c.lng)
    .map((c) => ({ lat: Number(c.lat), lng: Number(c.lng), kind: "center" as const, label: c.code, align: (c.code === "KTM" ? "above" : "right") as "above" | "right" }));
  return (
    <section id="network" className={`section on-forest ${s.network}`} aria-labelledby="network-title">
      <div className="wrap">
        <div className={s.networkHead}>
          <Editable k="home.network.kicker" as="p" className="margin-note" />
          <h2 id="network-title" className="h1">
            <Editable k="home.network.title" />
          </h2>
          <Editable k="home.network.body" as="p" className="lede" multiline />
        </div>
        <div className={s.networkBody}>
          <NepalMap nodes={nodes} draw="view" tone="forest" contourDensity="light" title="Collection centres across Nepal" className={s.networkMap} />
          {centers.length ? (
            <table className={s.centerTable}>
              <caption className="sr-only">Collection centres</caption>
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Centre</th>
                  <th scope="col">Province</th>
                </tr>
              </thead>
              <tbody>
                {centers.map((c) => (
                  <tr key={c.code}>
                    <td className="code">{c.code}</td>
                    <td>
                      {c.name}
                      {showSample && c.isDemo ? <span className="tag tag-sample">Sample</span> : null}
                    </td>
                    <td>{c.province ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="lede">Collection centres will be listed here as they open.</p>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Quality: measured vs limit, and the honest boundary ── */
export function Quality({ trace }: { trace: PublicTrace | null }) {
  const tests = trace?.tests ?? [];
  return (
    <section className={`section ${s.quality}`} aria-labelledby="quality-title">
      <div className="wrap margin-grid">
        <Editable k="home.quality.kicker" as="p" className="margin-note" />
        <div className={s.qualityGrid}>
          <div>
            <h2 id="quality-title" className="h1">
              <Editable k="home.quality.title" />
            </h2>
            <Editable k="home.quality.body" as="p" className={`body-serif ${s.qualityBody}`} multiline />
          </div>
          <div className={s.columns2}>
            <div>
              <h3 className={s.listTitle}>On every trace page</h3>
              <ul className={s.plainList} role="list">
                <li>Origin district and harvest date</li>
                <li>Collection centre and net weight received</li>
                <li>Inspection results and grade</li>
                <li>Processing steps with input and output weight</li>
                <li>Pack count and availability</li>
              </ul>
            </div>
            <div>
              <h3 className={s.listTitle}>Never published</h3>
              <ul className={`${s.plainList} ${s.never}`} role="list">
                <li>Producers’ names without their consent</li>
                <li>Phone numbers, exact farm locations</li>
                <li>Prices paid to producers</li>
                <li>Lab results that don’t exist</li>
                <li>Certifications not on file</li>
              </ul>
            </div>
          </div>
          {tests.length ? (
            <div className={s.measure} data-inview="">
              <p className="small muted">
                Checks recorded for batch <span className="code">{trace!.code}</span>
              </p>
              {tests.map((t) => {
                const limit = Number((t.limit ?? "").replace(/[^\d.]/g, "")) || null;
                const pct = limit && t.value != null ? Math.min(100, (t.value / limit) * 100) : null;
                return (
                  <div key={t.testType} className={s.measureRow}>
                    <span>{t.testType}</span>
                    <span className={s.bar} aria-hidden="true">
                      <i style={{ ["--w" as string]: `${pct ?? 0}%` }} />
                      <b />
                    </span>
                    <span className="num">
                      {t.value}
                      {t.unit} <span className="muted">limit {t.limit}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ── Market preview ── */
export function MarketPreview({ products, showSample }: { products: Card[]; showSample: boolean }) {
  if (!products.length) return null;
  return (
    <section className={`section ${s.market}`} aria-labelledby="market-title">
      <div className="wrap">
        <div className={s.marketHead}>
          <div>
            <Editable k="home.market.kicker" as="p" className="margin-note" />
            <h2 id="market-title" className="h1">
              <Editable k="home.market.title" />
            </h2>
          </div>
          <Link href="/market" className="btn btn-ghost" data-magnetic>
            See all products
          </Link>
        </div>
      </div>
      <div className={s.rail} tabIndex={0} aria-label="Featured products, scrollable">
        <ul role="list">
          {products.map((p, i) => (
            <li key={p.id}>
              <ProductCard product={p} showSample={showSample} priority={i < 2} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── Try a trace ── */
export function TrySection({ codes, showSample }: { codes: { code: string; commodity: string; isDemo: boolean }[]; showSample: boolean }) {
  return (
    <section className={`section ${s.try}`} aria-labelledby="try-title">
      <div className={`wrap ${s.tryGrid}`}>
        <div>
          <Editable k="home.trace.kicker" as="p" className="margin-note" />
          <h2 id="try-title" className="h1">
            <Editable k="home.trace.title" />
          </h2>
          <Editable k="home.trace.body" as="p" className="lede" multiline />
        </div>
        <div className={s.tryBox}>
          <TraceLookup placeholder={codes[0]?.code ?? "HIM-26-KTM-00482"} />
          {codes.length ? (
            <div className={s.tryCodes}>
              <p className="small muted">{showSample && codes.some((c) => c.isDemo) ? "Sample batches to try" : "Recent batches"}</p>
              <ul role="list">
                {codes.map((c) => (
                  <li key={c.code}>
                    <Link href={`/trace/${c.code}`}>
                      <span className="code">{c.code}</span>
                      <span>{c.commodity}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ── Technology: the ledger, with live counts ── */
export function Ledger({ counts, showSample }: { counts: Awaited<ReturnType<typeof import("@/server/home/queries").getLedgerCounts>>; showSample: boolean }) {
  const rows = [
    { name: "Collection receipts", n: fmtInt(counts.receipts), what: "Who delivered what, where, and how much it weighed" },
    { name: "Inspections", n: fmtInt(counts.inspections), what: "Moisture, foreign matter, grade, accepted quantity" },
    { name: "Procurements", n: fmtInt(counts.procurements), what: "Accepted weight × approved rate, linked to payment" },
    { name: "Batches", n: fmtInt(counts.batches), what: "Lots combined under one permanent code" },
    { name: "Processing runs", n: fmtInt(counts.runs), what: "Input and output weight for every step" },
    { name: "Packs", n: fmtInt(counts.packs), what: "Each one printed with its batch code" },
    { name: "Trace events", n: fmtInt(counts.events), what: "The public view, generated from the rows above" },
    { name: "Orders", n: fmtInt(counts.orders), what: "Order lines keep the batch they were filled from" },
  ];
  return (
    <section className={`section ${s.ledger}`} aria-labelledby="ledger-title">
      <div className="wrap margin-grid">
        <Editable k="home.tech.kicker" as="p" className="margin-note" />
        <div>
          <h2 id="ledger-title" className="h1">
            <Editable k="home.tech.title" />
          </h2>
          <Editable k="home.tech.body" as="p" className={`body-serif ${s.ledgerBody}`} multiline />
          <table className={s.ledgerTable}>
            <caption>
              Records in the platform right now
              {showSample ? <span className="tag tag-sample">Includes sample data</span> : null}
            </caption>
            <thead>
              <tr>
                <th scope="col">Record</th>
                <th scope="col" className={s.right}>
                  Count
                </th>
                <th scope="col">What it holds</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <th scope="row">{r.name}</th>
                  <td className={`num ${s.right} ${s.ledgerN}`}>{r.n}</td>
                  <td>{r.what}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small muted">{fmtKg(counts.netKg, 0)} received across all collection receipts.</p>
        </div>
      </div>
    </section>
  );
}

/* ── Audiences ── */
export function Audiences({ c }: { c: ContentMap }) {
  return (
    <section className={`section ${s.aud}`} aria-labelledby="aud-title">
      <div className="wrap">
        <h2 id="aud-title" className="h2">
          <Editable k="home.audiences.title" />
        </h2>
        <ul className={s.audList} role="list">
          {c["home.audiences.items"].map((a) => (
            <li key={a.who}>
              <Link href={a.cta.href} className={s.audRow}>
                <span className={s.audWho}>{a.who}</span>
                <span className={s.audLine}>{a.line}</span>
                <span className={s.audCta}>{a.cta.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── Owner ── */
export function Owner({ c }: { c: ContentMap }) {
  const img = c["owner.image"];
  return (
    <section className={`section ${s.owner}`} aria-labelledby="owner-title">
      <div className={`wrap ${s.ownerGrid}`}>
        {img ? <MediaImage id={img} alt={c["owner.name"]} className={s.ownerPhoto} /> : null}
        <div>
          <p className="margin-note">Ownership</p>
          <h2 id="owner-title" className={`display ${s.ownerName}`}>
            <Editable k="owner.name" />
          </h2>
          <Editable k="owner.title" as="p" className={s.ownerTitle} />
          {c["owner.bio"] ? <p className={`body-serif ${s.ownerBio}`}>{c["owner.bio"]}</p> : null}
          <Link href="/company" className="link">
            About the company
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Contact ── */
export function ContactCta({ c }: { c: ContentMap }) {
  const items = [
    c["contact.email"] && { k: "Email", v: c["contact.email"], href: `mailto:${c["contact.email"]}` },
    c["contact.phone"] && { k: "Phone", v: c["contact.phone"], href: `tel:${c["contact.phone"].replace(/[^\d+]/g, "")}` },
    c["contact.whatsapp"] && { k: "WhatsApp", v: c["contact.whatsapp"], href: `https://wa.me/${c["contact.whatsapp"].replace(/\D/g, "")}` },
    c["contact.address"] && { k: "Address", v: c["contact.address"] },
  ].filter(Boolean) as { k: string; v: string; href?: string }[];
  return (
    <section className={`section on-forest ${s.contact}`} aria-labelledby="contact-title">
      <div className={`wrap ${s.contactGrid}`}>
        <h2 id="contact-title" className="display">
          <Editable k="contact.title" />
        </h2>
        <div className={s.contactSide}>
          <Editable k="contact.body" as="p" className="lede" multiline />
          {items.length ? (
            <dl className={s.contactList}>
              {items.map((i) => (
                <div key={i.k}>
                  <dt>{i.k}</dt>
                  <dd>{i.href ? <a href={i.href}>{i.v}</a> : i.v}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className={s.heroActions}>
            <Link href="/contact" className="btn" data-magnetic>
              Send a message
            </Link>
            <Link href="/trace" className="btn btn-ghost">
              Trace a batch
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
