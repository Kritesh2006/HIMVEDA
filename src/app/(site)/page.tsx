import { getContent } from "@/server/content/service";
import { getFeaturedProducts } from "@/server/catalog/queries";
import { getHeroTrace, getLedgerCounts, getSpecimenReceipt, listPublicBatchCodes, listPublicCenters } from "@/server/home/queries";
import { Hero } from "@/components/home/Hero";
import { ChainStory, type SheetRow } from "@/components/home/ChainStory";
import { Editable } from "@/components/edit/Editable";
import { Audiences, ContactCta, Ecosystem, Ledger, MarketPreview, Network, Owner, Producers, Quality, TrySection } from "@/components/home/Sections";
import { fmtDate, fmtInt, fmtKg } from "@/lib/format";
import type { PublicTrace } from "@/server/trace/queries";
import s from "@/components/home/home.module.css";

export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: "/" } };

function chainSheets(t: PublicTrace | null): SheetRow[][] {
  if (!t) return [[], [], [], [], []];
  const ev = (stage: string) => t.events.find((e) => e.stage === stage);
  const m = (stage: string, k: string) => {
    const v = ev(stage)?.metrics[k];
    return typeof v === "number" ? v : null;
  };
  return [
    [
      { label: "Producer ID", value: `${t.producerCount} registered producer${t.producerCount === 1 ? "" : "s"}` },
      { label: "District", value: t.originDistrict ?? "—" },
      { label: "Harvest", value: fmtDate(t.harvestDate) },
    ],
    [
      { label: "Receipt", value: `${m("collected", "receipts") ?? "—"} numbered receipts` },
      { label: "Weight", value: fmtKg(m("collected", "netKg")) + " net" },
      { label: "Centre", value: t.center ? `${t.center.code} · ${t.center.district}` : "—" },
    ],
    [
      { label: "Moisture", value: m("inspected", "avgMoisturePct") != null ? `${m("inspected", "avgMoisturePct")}% average` : "—" },
      { label: "Foreign matter", value: "Recorded per delivery" },
      { label: "Grade", value: `${t.qualityGrade} · ${fmtKg(m("verified", "acceptedKg"))} accepted` },
    ],
    [
      { label: "Batch", value: t.code },
      { label: "Weight", value: `${fmtKg(m("processed", "inKg"))} → ${fmtKg(m("processed", "outKg"))}` },
      { label: "Packs", value: fmtInt(t.unitsPacked) },
    ],
    [
      { label: "Trace", value: `/trace/${t.code}` },
      { label: "Stock", value: t.product ? t.product.name : "—" },
      { label: "Order", value: "Batch code on every order line" },
    ],
  ];
}

export default async function HomePage() {
  const c = await getContent();
  const [trace, centers, products, receipt, codes, counts] = await Promise.all([
    getHeroTrace(c["home.hero.batch"]),
    listPublicCenters(),
    getFeaturedProducts(8),
    getSpecimenReceipt(),
    listPublicBatchCodes(4),
    getLedgerCounts(),
  ]);
  const demo = c["settings.demoMode"];

  return (
    <>
      <Hero trace={trace} centers={centers} showSample={demo} />
      <Ecosystem />
      <section className={`section on-forest ${s.chainSection}`} aria-labelledby="chain-title">
        <div className="wrap">
          <Editable k="home.chain.kicker" as="p" className="margin-note" />
          <h2 id="chain-title" className={`h1 ${s.chainIntro}`}>
            <Editable k="home.chain.title" />
          </h2>
          <ChainStory steps={c["home.chain.steps"]} sheets={chainSheets(trace)} code={trace?.code ?? null} isSample={demo && Boolean(trace?.isDemo)} />
        </div>
      </section>
      <Producers receipt={receipt} showSample={demo} />
      <Network centers={centers} showSample={demo} />
      <Quality trace={trace} />
      <MarketPreview products={products} showSample={demo} />
      <TrySection codes={codes} showSample={demo} />
      <Ledger counts={counts} showSample={demo} />
      <Audiences c={c} />
      <Owner c={c} />
      <ContactCta c={c} />
    </>
  );
}
