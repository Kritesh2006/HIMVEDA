/**
 * Seeds a CONNECTED DEMONSTRATION SCENARIO.
 *
 * Every row created here is flagged `is_demo = true`, rendered with a "Sample"
 * label on the public site and in Studio, and removable in one action
 * (Studio → Settings → Remove demonstration data).
 *
 * The producers, collection centres, batches, prices and orders below are
 * FICTIONAL. They illustrate how the platform works; they are not HIMVEDA
 * partners, products or prices.
 *
 *   npm run db:seed            # seed if empty
 *   npm run db:seed -- --force # remove existing demo data, then reseed
 */
import { count, eq } from "drizzle-orm";
import { db, pool, schema } from "./db";
import { purgeDemoData } from "../src/server/demo/purge";
import { DEV_NPR_PER_UNIT } from "../src/server/currency/dev-rates";

const force = process.argv.includes("--force");
const kg = (n: number) => Math.round(n * 1000);
const npr = (n: number) => Math.round(n * 100);
const d = (s: string) => new Date(`${s}T09:30:00+05:45`);
const addDays = (s: string, days: number) => {
  const t = d(s);
  t.setUTCDate(t.getUTCDate() + days);
  return t;
};

async function main() {
  const existing = (await db.select({ value: count() }).from(schema.products))[0]?.value ?? 0;
  if (existing > 0 && !force) {
    console.log(`Database already has ${existing} products. Use --force to replace demonstration data.`);
    return;
  }
  if (force) {
    const removed = await purgeDemoData(db);
    console.log("✓ removed previous demo data", removed);
  }

  /* ── FX (documented development rates) ─────────────────────────── */
  for (const [currency, nprPerUnit] of Object.entries(DEV_NPR_PER_UNIT)) {
    const rate = (1 / nprPerUnit).toFixed(10);
    await db
      .insert(schema.currencyRates)
      .values({ currency, ratePerNpr: rate, source: "dev-static" })
      .onConflictDoUpdate({ target: schema.currencyRates.currency, set: { ratePerNpr: rate, source: "dev-static", fetchedAt: new Date() } });
  }
  const roundingRules = [
    { currency: "NPR", rounding: "whole" as const },
    { currency: "JPY", rounding: "whole" as const },
    { currency: "KRW", rounding: "whole" as const },
  ];
  const haveRounding = await db.select().from(schema.pricingRules).where(eq(schema.pricingRules.kind, "display_rounding"));
  if (!haveRounding.length) {
    await db.insert(schema.pricingRules).values(
      roundingRules.map((r) => ({ kind: "display_rounding" as const, name: `${r.currency} display rounding`, currency: r.currency, rounding: r.rounding })),
    );
  }

  /* ── Categories (generic, not demo) ───────────────────────────── */
  const cats = [
    { slug: "spices", name: "Spices", nameNe: "मसला", description: "Whole and ground spices from Nepal's hills.", sortOrder: 1 },
    { slug: "tea", name: "Tea", nameNe: "चिया", description: "Orthodox and specialty teas.", sortOrder: 2 },
    { slug: "grains", name: "Grains & flours", nameNe: "अन्न", description: "Heritage rice, millets and flours.", sortOrder: 3 },
    { slug: "roots", name: "Roots & rhizomes", nameNe: "कन्दमूल", description: "Turmeric, ginger and other roots, dried or ground.", sortOrder: 4 },
  ];
  for (const c of cats) {
    await db.insert(schema.categories).values(c).onConflictDoNothing({ target: schema.categories.slug });
  }
  const catRows = await db.select().from(schema.categories);
  const cat = (slug: string) => catRows.find((c) => c.slug === slug)!.id;

  /* ── Collection network (fictional) ───────────────────────────── */
  const centerDefs = [
    { code: "TPJ", name: "Taplejung collection centre", district: "Taplejung", province: "Koshi", lat: "27.3500", lng: "87.6700" },
    { code: "ILM", name: "Ilam collection centre", district: "Ilam", province: "Koshi", lat: "26.9100", lng: "87.9300" },
    { code: "KTM", name: "Kathmandu Valley collection point", district: "Bhaktapur", province: "Bagmati", lat: "27.6720", lng: "85.4290" },
    { code: "JUM", name: "Jumla collection centre", district: "Jumla", province: "Karnali", lat: "29.2740", lng: "82.1840" },
    { code: "SKT", name: "Surkhet collection centre", district: "Surkhet", province: "Karnali", lat: "28.6010", lng: "81.6230" },
  ];
  const centers = await db
    .insert(schema.collectionCenters)
    .values(centerDefs.map((c) => ({ ...c, isPublic: true, isDemo: true, address: null })))
    .returning();
  const center = (code: string) => centers.find((c) => c.code === code)!;

  const locations = await db
    .insert(schema.inventoryLocations)
    .values([
      ...centers.map((c) => ({ code: `CC-${c.code}`, name: c.name, kind: "collection_center" as const, district: c.district, collectionCenterId: c.id, isDemo: true })),
      { code: "PR-KTM", name: "Kathmandu processing unit", kind: "processing" as const, district: "Kathmandu", isDemo: true },
      { code: "WH-KTM", name: "Kathmandu dispatch warehouse", kind: "warehouse" as const, district: "Kathmandu", isDemo: true },
    ])
    .returning();
  const loc = (code: string) => locations.find((l) => l.code === code)!;

  /* ── Producers (fictional; no publish consent) ────────────────── */
  const farmerDefs = [
    { code: "FMR-0001", fullName: "Bishnu Limbu", district: "Taplejung", municipality: "Phungling", cooperative: "Sample Cardamom Group", farm: { name: "Upper terrace plot", alt: 1850, lat: "27.3800", lng: "87.6500", area: "6.00", crops: ["large cardamom"] } },
    { code: "FMR-0002", fullName: "Maya Subba", district: "Taplejung", municipality: "Phungling", cooperative: "Sample Cardamom Group", farm: { name: "Riverside shade plot", alt: 1620, lat: "27.3300", lng: "87.7100", area: "4.50", crops: ["large cardamom"] } },
    { code: "FMR-0003", fullName: "Dil Kumar Rai", district: "Taplejung", municipality: "Sirijangha", cooperative: null, farm: { name: "North slope plot", alt: 2010, lat: "27.4200", lng: "87.6900", area: "3.25", crops: ["large cardamom"] } },
    { code: "FMR-0004", fullName: "Kamala Rai", district: "Ilam", municipality: "Suryodaya", cooperative: "Sample Tea Cooperative", farm: { name: "Hillside garden", alt: 1450, lat: "26.9300", lng: "88.0300", area: "8.00", crops: ["tea", "akabare chilli"] } },
    { code: "FMR-0005", fullName: "Prem Gurung", district: "Ilam", municipality: "Mai", cooperative: "Sample Tea Cooperative", farm: { name: "Ridge garden", alt: 1280, lat: "26.8800", lng: "87.9100", area: "5.50", crops: ["tea", "akabare chilli"] } },
    { code: "FMR-0006", fullName: "Hari Bahadur Rokaya", district: "Jumla", municipality: "Chandannath", cooperative: null, farm: { name: "Valley paddy", alt: 2380, lat: "29.2600", lng: "82.2100", area: "10.00", crops: ["marsi red rice"] } },
    { code: "FMR-0007", fullName: "Kalpana Shahi", district: "Jumla", municipality: "Tatopani", cooperative: null, farm: { name: "Upper field", alt: 2560, lat: "29.3100", lng: "82.1300", area: "7.25", crops: ["buckwheat", "marsi red rice"] } },
    { code: "FMR-0008", fullName: "Gopal Budha", district: "Surkhet", municipality: "Birendranagar", cooperative: null, farm: { name: "Forest-edge plot", alt: 1150, lat: "28.6400", lng: "81.6800", area: "3.00", crops: ["timur"] } },
    { code: "FMR-0009", fullName: "Sita Shrestha", district: "Kavrepalanchok", municipality: "Panauti", cooperative: "Sample Spice Collective", farm: { name: "Lower terrace", alt: 1420, lat: "27.5800", lng: "85.5200", area: "5.00", crops: ["turmeric", "ginger"] } },
    { code: "FMR-0010", fullName: "Ram Krishna Dahal", district: "Kavrepalanchok", municipality: "Namobuddha", cooperative: "Sample Spice Collective", farm: { name: "South field", alt: 1560, lat: "27.5600", lng: "85.5800", area: "6.75", crops: ["turmeric"] } },
  ];
  const farmerRows: Record<string, { farmerId: string; farmId: string; district: string }> = {};
  for (const f of farmerDefs) {
    const [fr] = await db
      .insert(schema.farmers)
      .values({ code: f.code, fullName: f.fullName, district: f.district, municipality: f.municipality, cooperative: f.cooperative, isDemo: true })
      .returning();
    const [fm] = await db
      .insert(schema.farms)
      .values({ farmerId: fr!.id, name: f.farm.name, district: f.district, altitudeM: f.farm.alt, approxLat: f.farm.lat, approxLng: f.farm.lng, areaRopani: f.farm.area, crops: f.farm.crops, isDemo: true })
      .returning();
    farmerRows[f.code] = { farmerId: fr!.id, farmId: fm!.id, district: f.district };
  }

  /* ── Procurement rate rules (controlled pricing) ───────────────── */
  const rateDefs = [
    { commodity: "Large cardamom (dried)", center: "TPJ", rate: 1450 },
    { commodity: "Orthodox black tea (made)", center: "ILM", rate: 520 },
    { commodity: "Akabare chilli (dried)", center: "ILM", rate: 700 },
    { commodity: "Fresh turmeric rhizome", center: "KTM", rate: 45 },
    { commodity: "Marsi red paddy", center: "JUM", rate: 95 },
    { commodity: "Buckwheat grain", center: "JUM", rate: 90 },
    { commodity: "Timur (dried)", center: "SKT", rate: 620 },
  ];
  const rules = await db
    .insert(schema.pricingRules)
    .values(
      rateDefs.map((r) => ({
        kind: "procurement_rate" as const,
        name: `${r.commodity} · ${r.center}`,
        commodity: r.commodity,
        collectionCenterId: center(r.center).id,
        ratePerKgMinor: npr(r.rate),
        gradeMultipliers: { A: 1, B: 0.9, C: 0.8 },
        isDemo: true,
      })),
    )
    .returning();
  const rule = (commodity: string) => rules.find((r) => r.commodity === commodity)!;
  await db.insert(schema.priceApprovals).values({
    pricingRuleId: rule("Large cardamom (dried)").id,
    previousMinor: npr(1450),
    proposedMinor: npr(1520),
    note: "Sample request: market rate rose at the district haat this week.",
    isDemo: true,
  });

  /* ── Products, batches and the full chain ──────────────────────── */
  interface ChainDef {
    product: {
      slug: string;
      name: string;
      category: string;
      short: string;
      description: string;
      unit: string;
      visual: string;
      processing: string;
      featured: boolean;
      variants: { label: string; sku: string; grams: number; price: number; stock: number; regional?: Record<string, number> }[];
    };
    batch: { code: string; commodity: string; rule: string; center: string; district: string; harvest: string; grade: "A" | "B"; summary: string };
    receipts: { farmer: string; date: string; grossKg: number; tareKg: number; moisture: number; foreign: number; grade: "A" | "B" | "C"; acceptPct: number }[];
    runs: { process: string; days: number; outRatio: number }[];
    packs: Record<string, number>; // sku → units packed
    tests: { type: string; method: string; value: number; unit: string; limit: string }[];
    paid: boolean;
  }

  const chains: ChainDef[] = [
    {
      product: {
        slug: "turmeric-powder-kavre",
        name: "Turmeric Powder",
        category: "roots",
        short: "Boiled, sun-dried and stone-ground turmeric from the terraces of Kavrepalanchok.",
        description:
          "Fresh rhizomes are washed, boiled, sun-dried and ground in small runs, then packed in light-proof pouches. Colour and aroma vary naturally from batch to batch — the trace page shows exactly which harvest is in your pack.",
        unit: "pouch",
        visual: "root",
        processing: "Washed → boiled → sun-dried (12 days) → ground → sieved → packed",
        featured: true,
        variants: [
          { label: "200 g", sku: "DEMO-TUR-200", grams: 200, price: 280, stock: 140 },
          { label: "500 g", sku: "DEMO-TUR-500", grams: 500, price: 650, stock: 62 },
        ],
      },
      batch: { code: "HIM-26-KTM-00482", rule: "Fresh turmeric rhizome", commodity: "Turmeric", center: "KTM", district: "Kavrepalanchok", harvest: "2026-01-18", grade: "A", summary: "Two terraces in Kavrepalanchok, collected in late January, processed in Kathmandu." },
      receipts: [
        { farmer: "FMR-0009", date: "2026-01-24", grossKg: 1320, tareKg: 38, moisture: 81.5, foreign: 0.6, grade: "A", acceptPct: 0.985 },
        { farmer: "FMR-0010", date: "2026-01-26", grossKg: 1165, tareKg: 33, moisture: 82.1, foreign: 0.9, grade: "A", acceptPct: 0.97 },
      ],
      runs: [
        { process: "Washing & boiling", days: 2, outRatio: 0.96 },
        { process: "Sun drying", days: 12, outRatio: 0.21 },
        { process: "Grinding & sieving", days: 2, outRatio: 0.975 },
      ],
      packs: { "DEMO-TUR-200": 1100, "DEMO-TUR-500": 340 },
      tests: [
        { type: "Moisture (finished powder)", method: "Oven-dry, in-house", value: 8.9, unit: "%", limit: "≤ 10%" },
        { type: "Visible foreign matter", method: "Visual sieve check, in-house", value: 0.2, unit: "%", limit: "≤ 1%" },
      ],
      paid: true,
    },
    {
      product: {
        slug: "large-cardamom-taplejung",
        name: "Large Cardamom",
        category: "spices",
        short: "Smoke-dried black cardamom pods from Taplejung's shaded hillsides.",
        description:
          "Large cardamom (alaichi) is grown under forest shade in eastern Nepal and dried over wood fire, which gives the pods their smoky depth. Sold whole; crush just before use.",
        unit: "pouch",
        visual: "pod",
        processing: "Fire-dried at source → graded by size → cleaned → packed whole",
        featured: true,
        variants: [
          { label: "100 g", sku: "DEMO-CAR-100", grams: 100, price: 450, stock: 210, regional: { USD: 4.5, GBP: 3.5 } },
          { label: "250 g", sku: "DEMO-CAR-250", grams: 250, price: 1050, stock: 88 },
        ],
      },
      batch: { code: "HIM-26-TPJ-00217", rule: "Large cardamom (dried)", commodity: "Large cardamom", center: "TPJ", district: "Taplejung", harvest: "2026-09-12", grade: "A", summary: "Three shade-grown plots between 1,600 and 2,000 m in Taplejung." },
      receipts: [
        { farmer: "FMR-0001", date: "2026-09-21", grossKg: 182.4, tareKg: 2.4, moisture: 11.8, foreign: 0.8, grade: "A", acceptPct: 0.98 },
        { farmer: "FMR-0002", date: "2026-09-22", grossKg: 146.0, tareKg: 2.0, moisture: 12.4, foreign: 1.1, grade: "A", acceptPct: 0.97 },
        { farmer: "FMR-0003", date: "2026-09-24", grossKg: 121.6, tareKg: 1.6, moisture: 12.9, foreign: 1.4, grade: "B", acceptPct: 0.95 },
      ],
      runs: [
        { process: "Cleaning & size grading", days: 3, outRatio: 0.965 },
        { process: "Packing", days: 1, outRatio: 0.995 },
      ],
      packs: { "DEMO-CAR-100": 2600, "DEMO-CAR-250": 620 },
      tests: [{ type: "Moisture", method: "Moisture meter, in-house", value: 10.6, unit: "%", limit: "≤ 12%" }],
      paid: false,
    },
    {
      product: {
        slug: "ilam-orthodox-black-tea",
        name: "Ilam Orthodox Black Tea",
        category: "tea",
        short: "Hand-sorted summer-flush orthodox tea from smallholder gardens in Ilam.",
        description:
          "Whole-leaf orthodox tea made from smallholder leaf in Ilam's summer flush. Bright, malty cup with a light muscatel edge. Brew at just-off-boil for three to four minutes.",
        unit: "tin",
        visual: "leaf",
        processing: "Withered → rolled → oxidised → fired → hand-sorted → packed",
        featured: true,
        variants: [
          { label: "100 g", sku: "DEMO-TEA-100", grams: 100, price: 650, stock: 96 },
          { label: "250 g", sku: "DEMO-TEA-250", grams: 250, price: 1500, stock: 31 },
        ],
      },
      batch: { code: "HIM-26-ILM-00341", rule: "Orthodox black tea (made)", commodity: "Orthodox black tea", center: "ILM", district: "Ilam", harvest: "2026-06-20", grade: "A", summary: "Summer-flush made tea from two smallholder gardens in Ilam." },
      receipts: [
        { farmer: "FMR-0004", date: "2026-07-02", grossKg: 64.8, tareKg: 1.2, moisture: 4.1, foreign: 0.3, grade: "A", acceptPct: 0.99 },
        { farmer: "FMR-0005", date: "2026-07-03", grossKg: 52.5, tareKg: 1.0, moisture: 4.4, foreign: 0.4, grade: "A", acceptPct: 0.98 },
      ],
      runs: [
        { process: "Hand sorting", days: 2, outRatio: 0.94 },
        { process: "Packing", days: 1, outRatio: 0.995 },
      ],
      packs: { "DEMO-TEA-100": 600, "DEMO-TEA-250": 170 },
      tests: [{ type: "Moisture", method: "Moisture meter, in-house", value: 3.8, unit: "%", limit: "≤ 6%" }],
      paid: true,
    },
    {
      product: {
        slug: "akabare-chilli-ilam",
        name: "Akabare Chilli, Dried",
        category: "spices",
        short: "Round, fiercely hot Akabare chillies from Ilam, sun-dried whole.",
        description: "The round ‘dalle’ chilli of eastern Nepal, picked ripe and sun-dried whole. Very hot — use sparingly in achar, jhol and dry rubs.",
        unit: "pouch",
        visual: "berry",
        processing: "Sun-dried whole → sorted → packed",
        featured: false,
        variants: [{ label: "50 g", sku: "DEMO-CHI-050", grams: 50, price: 260, stock: 75 }],
      },
      batch: { code: "HIM-26-ILM-00352", rule: "Akabare chilli (dried)", commodity: "Akabare chilli", center: "ILM", district: "Ilam", harvest: "2026-08-28", grade: "B", summary: "Sun-dried Akabare from an Ilam ridge garden." },
      receipts: [{ farmer: "FMR-0005", date: "2026-09-08", grossKg: 28.4, tareKg: 0.6, moisture: 9.5, foreign: 1.6, grade: "B", acceptPct: 0.94 }],
      runs: [{ process: "Sorting & packing", days: 1, outRatio: 0.97 }],
      packs: { "DEMO-CHI-050": 480 },
      tests: [],
      paid: false,
    },
    {
      product: {
        slug: "jumla-marsi-red-rice",
        name: "Jumla Marsi Red Rice",
        category: "grains",
        short: "Cold-tolerant red rice grown at around 2,400 m in the Karnali.",
        description: "Marsi is a red rice landrace grown in the high valleys of Jumla. Lightly milled to keep the bran; nutty and firm when cooked. Rinse and soak for 30 minutes before cooking.",
        unit: "bag",
        visual: "grain",
        processing: "Sun-dried paddy → hulled → lightly polished → cleaned → bagged",
        featured: true,
        variants: [
          { label: "1 kg", sku: "DEMO-RIC-1KG", grams: 1000, price: 380, stock: 120 },
          { label: "5 kg", sku: "DEMO-RIC-5KG", grams: 5000, price: 1800, stock: 24 },
        ],
      },
      batch: { code: "HIM-26-JUM-00128", rule: "Marsi red paddy", commodity: "Marsi red rice", center: "JUM", district: "Jumla", harvest: "2025-10-30", grade: "A", summary: "Valley paddy from Chandannath, milled in spring." },
      receipts: [
        { farmer: "FMR-0006", date: "2026-03-10", grossKg: 640, tareKg: 12, moisture: 13.2, foreign: 1.2, grade: "A", acceptPct: 0.97 },
        { farmer: "FMR-0007", date: "2026-03-11", grossKg: 410, tareKg: 8, moisture: 13.6, foreign: 1.5, grade: "A", acceptPct: 0.96 },
      ],
      runs: [
        { process: "Hulling & light polishing", days: 2, outRatio: 0.68 },
        { process: "Cleaning & bagging", days: 1, outRatio: 0.985 },
      ],
      packs: { "DEMO-RIC-1KG": 420, "DEMO-RIC-5KG": 48 },
      tests: [{ type: "Moisture", method: "Grain moisture meter, in-house", value: 12.4, unit: "%", limit: "≤ 14%" }],
      paid: true,
    },
    {
      product: {
        slug: "buckwheat-flour-jumla",
        name: "Buckwheat Flour (Phapar)",
        category: "grains",
        short: "Stone-milled buckwheat from Jumla's upper fields.",
        description: "Buckwheat grown above 2,500 m and stone-milled into a coarse flour for dhindo, roti and pancakes. Store airtight in a cool place.",
        unit: "bag",
        visual: "seed",
        processing: "Cleaned → dehusked → stone-milled → sieved → bagged",
        featured: false,
        variants: [{ label: "1 kg", sku: "DEMO-BUK-1KG", grams: 1000, price: 320, stock: 0 }],
      },
      batch: { code: "HIM-26-JUM-00131", rule: "Buckwheat grain", commodity: "Buckwheat", center: "JUM", district: "Jumla", harvest: "2026-09-05", grade: "B", summary: "Upper-field buckwheat from Tatopani." },
      receipts: [{ farmer: "FMR-0007", date: "2026-09-16", grossKg: 236, tareKg: 4, moisture: 12.8, foreign: 2.1, grade: "B", acceptPct: 0.93 }],
      runs: [{ process: "Stone milling & sieving", days: 2, outRatio: 0.82 }],
      packs: { "DEMO-BUK-1KG": 170 },
      tests: [],
      paid: false,
    },
    {
      product: {
        slug: "timur-surkhet",
        name: "Timur (Himalayan Pepper)",
        category: "spices",
        short: "Citrusy, tingling timur berries from the mid-hills of Surkhet.",
        description: "Timur is Nepal's Zanthoxylum pepper — floral, citrusy and mouth-tingling. Toast lightly and grind for achar, chutneys and tomato pickle.",
        unit: "pouch",
        visual: "berry",
        processing: "Shade-dried → seeds removed → cleaned → packed whole",
        featured: true,
        variants: [
          { label: "50 g", sku: "DEMO-TIM-050", grams: 50, price: 220, stock: 160 },
          { label: "100 g", sku: "DEMO-TIM-100", grams: 100, price: 400, stock: 72 },
        ],
      },
      batch: { code: "HIM-26-SKT-00093", rule: "Timur (dried)", commodity: "Timur", center: "SKT", district: "Surkhet", harvest: "2026-08-15", grade: "A", summary: "Forest-edge timur from Birendranagar, shade-dried." },
      receipts: [{ farmer: "FMR-0008", date: "2026-08-29", grossKg: 58.2, tareKg: 1.2, moisture: 10.4, foreign: 1.9, grade: "A", acceptPct: 0.95 }],
      runs: [{ process: "Seed removal & cleaning", days: 2, outRatio: 0.71 }],
      packs: { "DEMO-TIM-050": 400, "DEMO-TIM-100": 180 },
      tests: [{ type: "Moisture", method: "Moisture meter, in-house", value: 9.1, unit: "%", limit: "≤ 11%" }],
      paid: true,
    },
  ];

  let receiptSeq = 1000;
  for (const c of chains) {
    const cc = center(c.batch.center);
    const ccLoc = loc(`CC-${c.batch.center}`);
    const r = rule(c.batch.rule);

    // Product + variants
    const [p] = await db
      .insert(schema.products)
      .values({
        slug: c.product.slug,
        name: c.product.name,
        categoryId: cat(c.product.category),
        shortDescription: c.product.short,
        description: c.product.description,
        unit: c.product.unit,
        district: c.batch.district,
        collectionCenterId: cc.id,
        harvestDate: c.batch.harvest,
        qualityGrade: c.batch.grade,
        verificationStatus: "verified",
        processingInfo: c.product.processing,
        visual: c.product.visual,
        featured: c.product.featured,
        status: "published",
        publishedAt: new Date(),
        isDemo: true,
      })
      .returning();
    const variants = [];
    for (const [i, v] of c.product.variants.entries()) {
      const [row] = await db
        .insert(schema.productVariants)
        .values({ productId: p!.id, label: v.label, sku: v.sku, weightGrams: v.grams, basePriceMinor: npr(v.price), stock: v.stock, isDefault: i === 0, sortOrder: i })
        .returning();
      variants.push(row!);
      for (const [currency, amount] of Object.entries(v.regional ?? {})) {
        await db.insert(schema.regionalPrices).values({ variantId: row!.id, currency, amountMinor: Math.round(amount * 100) });
      }
    }

    // Receipts → inspections → procurement → payments
    const receiptIds: string[] = [];
    let acceptedTotal = 0;
    let netTotal = 0;
    const moistures: number[] = [];
    for (const rc of c.receipts) {
      const f = farmerRows[rc.farmer]!;
      const net = rc.grossKg - rc.tareKg;
      const accepted = Math.round(net * rc.acceptPct * 10) / 10;
      netTotal += net;
      acceptedTotal += accepted;
      moistures.push(rc.moisture);
      const [receipt] = await db
        .insert(schema.collectionReceipts)
        .values({
          receiptNo: `RC-${c.batch.center}-${++receiptSeq}`,
          farmerId: f.farmerId,
          farmId: f.farmId,
          collectionCenterId: cc.id,
          commodity: r.commodity!,
          harvestDate: c.batch.harvest,
          grossGrams: kg(rc.grossKg),
          tareGrams: kg(rc.tareKg),
          netGrams: kg(net),
          moisturePct: rc.moisture.toFixed(2),
          receivedAt: d(rc.date),
          receivedBy: "Centre clerk (sample)",
          status: "procured",
          isDemo: true,
        })
        .returning();
      receiptIds.push(receipt!.id);
      await db.insert(schema.inspections).values({
        receiptId: receipt!.id,
        inspectedAt: addDays(rc.date, 0),
        inspector: "Quality officer (sample)",
        visualGrade: rc.grade,
        moisturePct: rc.moisture.toFixed(2),
        foreignMatterPct: rc.foreign.toFixed(2),
        acceptedGrams: kg(accepted),
        result: "pass",
        isDemo: true,
      });
      const mult = (r.gradeMultipliers ?? {})[rc.grade] ?? 1;
      const rate = Math.round(r.ratePerKgMinor! * mult);
      const total = Math.round(accepted * rate);
      const [proc] = await db
        .insert(schema.procurements)
        .values({ receiptId: receipt!.id, pricingRuleId: r.id, acceptedGrams: kg(accepted), ratePerKgMinor: rate, totalMinor: total, procuredAt: addDays(rc.date, 1), isDemo: true })
        .returning();
      await db.insert(schema.farmerPayments).values({
        farmerId: f.farmerId,
        procurementId: proc!.id,
        amountMinor: total,
        method: c.paid ? "Bank transfer" : null,
        reference: c.paid ? `SAMPLE-${receipt!.receiptNo}` : null,
        status: c.paid ? "paid" : "approved",
        paidAt: c.paid ? addDays(rc.date, 6) : null,
        isDemo: true,
      });
    }

    // Batch
    const lastReceipt = c.receipts.at(-1)!.date;
    let weight = acceptedTotal;
    const runPlan = c.runs.map((run) => {
      const out = Math.round(weight * run.outRatio * 10) / 10;
      const plan = { ...run, in: weight, out };
      weight = out;
      return plan;
    });
    const unitsPacked = Object.values(c.packs).reduce((s, n) => s + n, 0);
    const [batch] = await db
      .insert(schema.batches)
      .values({
        code: c.batch.code,
        commodity: c.batch.commodity,
        productId: p!.id,
        collectionCenterId: cc.id,
        originDistrict: c.batch.district,
        harvestDate: c.batch.harvest,
        stage: "available",
        inputGrams: kg(acceptedTotal),
        outputGrams: kg(weight),
        unitsPacked,
        qualityGrade: c.batch.grade,
        publicSummary: c.batch.summary,
        isPublic: true,
        isDemo: true,
      })
      .returning();
    await db.update(schema.products).set({ primaryBatchId: batch!.id }).where(eq(schema.products.id, p!.id));
    await db.insert(schema.batchReceipts).values(receiptIds.map((receiptId) => ({ batchId: batch!.id, receiptId })));

    // Movements: centre → processing
    await db.insert(schema.inventoryMovements).values({
      batchId: batch!.id,
      fromLocationId: ccLoc.id,
      toLocationId: loc("PR-KTM").id,
      quantity: kg(acceptedTotal),
      quantityUnit: "g",
      reason: "transfer",
      reference: c.batch.code,
      movedAt: addDays(lastReceipt, 3),
      isDemo: true,
    });

    // Processing runs
    let cursor = 4;
    for (const [i, run] of runPlan.entries()) {
      await db.insert(schema.processingRuns).values({
        code: `PR-${c.batch.code.slice(-5)}-${i + 1}`,
        batchId: batch!.id,
        locationId: loc("PR-KTM").id,
        process: run.process,
        startedAt: addDays(lastReceipt, cursor),
        completedAt: addDays(lastReceipt, cursor + run.days),
        inputGrams: kg(run.in),
        outputGrams: kg(run.out),
        isDemo: true,
      });
      cursor += run.days;
    }
    const processedAt = addDays(lastReceipt, cursor);

    // Quality tests (in-house only; no fabricated labs or certificates)
    for (const t of c.tests) {
      await db.insert(schema.qualityTests).values({
        batchId: batch!.id,
        testType: t.type,
        method: t.method,
        resultValue: String(t.value),
        resultUnit: t.unit,
        limitText: t.limit,
        passed: true,
        performedBy: "In-house (sample)",
        testedAt: processedAt,
        isDemo: true,
      });
    }

    // Packs into warehouse stock
    for (const v of variants) {
      const units = c.packs[v.sku] ?? 0;
      if (!units) continue;
      await db.insert(schema.inventoryMovements).values({
        batchId: batch!.id,
        variantId: v.id,
        toLocationId: loc("WH-KTM").id,
        quantity: units,
        quantityUnit: "unit",
        reason: "packed",
        reference: c.batch.code,
        movedAt: addDays(lastReceipt, cursor + 1),
        isDemo: true,
      });
    }

    // Public trace events
    const avgMoist = moistures.reduce((s, m) => s + m, 0) / moistures.length;
    const events = [
      { stage: "origin" as const, at: d(c.batch.harvest), title: `Harvested in ${c.batch.district}`, desc: `${c.receipts.length} producer${c.receipts.length > 1 ? "s" : ""} contributed to this batch.`, where: `${c.batch.district} district`, lat: null, lng: null, metrics: { producers: c.receipts.length } },
      { stage: "collected" as const, at: d(lastReceipt), title: `Weighed at ${cc.name}`, desc: "Each delivery was weighed gross and net and issued a numbered receipt.", where: cc.name, lat: cc.lat, lng: cc.lng, metrics: { netKg: Math.round(netTotal * 10) / 10, receipts: c.receipts.length } },
      { stage: "inspected" as const, at: d(lastReceipt), title: "Inspected on arrival", desc: "Moisture, foreign matter and visual grade recorded for every delivery.", where: cc.name, lat: cc.lat, lng: cc.lng, metrics: { avgMoisturePct: Math.round(avgMoist * 10) / 10 } },
      { stage: "verified" as const, at: addDays(lastReceipt, 1), title: `Accepted · grade ${c.batch.grade}`, desc: "Only the accepted quantity was purchased, at the approved centre rate.", where: cc.name, lat: cc.lat, lng: cc.lng, metrics: { acceptedKg: Math.round(acceptedTotal * 10) / 10 } },
      { stage: "processed" as const, at: processedAt, title: runPlan.map((x) => x.process).join(" · "), desc: "Processing runs logged with input and output weights.", where: "Kathmandu processing unit", lat: "27.7000", lng: "85.3200", metrics: { inKg: Math.round(acceptedTotal * 10) / 10, outKg: Math.round(weight * 10) / 10 } },
      { stage: "packaged" as const, at: addDays(lastReceipt, cursor + 1), title: `${unitsPacked.toLocaleString("en-IN")} packs sealed`, desc: "Each pack is printed with this batch code.", where: "Kathmandu dispatch warehouse", lat: "27.7000", lng: "85.3200", metrics: { packs: unitsPacked } },
      { stage: "available" as const, at: addDays(lastReceipt, cursor + 2), title: "Listed on the HIMVEDA market", desc: null, where: null, lat: null, lng: null, metrics: {} },
    ];
    await db.insert(schema.traceabilityEvents).values(
      events.map((e) => ({
        ...{},
        batchId: batch!.id,
        stage: e.stage,
        occurredAt: e.at,
        title: e.title,
        publicDescription: e.desc,
        locationLabel: e.where,
        district: e.stage === "origin" ? c.batch.district : null,
        lat: e.lat,
        lng: e.lng,
        metrics: e.metrics as Record<string, number>,
        isDemo: true,
      })),
    );
  }

  /* ── An in-progress batch (not yet public) and an unpublished product ── */
  const pending = farmerRows["FMR-0002"]!;
  const [openReceipt] = await db
    .insert(schema.collectionReceipts)
    .values({
      receiptNo: `RC-TPJ-${++receiptSeq}`,
      farmerId: pending.farmerId,
      farmId: pending.farmId,
      collectionCenterId: center("TPJ").id,
      commodity: "Large cardamom (dried)",
      harvestDate: "2026-10-02",
      grossGrams: kg(96.4),
      tareGrams: kg(1.4),
      netGrams: kg(95),
      moisturePct: "13.10",
      receivedAt: d("2026-10-11"),
      receivedBy: "Centre clerk (sample)",
      status: "received",
      isDemo: true,
    })
    .returning();
  void openReceipt;

  await db.insert(schema.products).values({
    slug: "dried-ginger-kavre",
    name: "Dried Ginger (Sutho)",
    categoryId: cat("roots"),
    shortDescription: "Sliced and sun-dried ginger from Kavrepalanchok.",
    description: "Draft listing — awaiting the next batch.",
    unit: "pouch",
    district: "Kavrepalanchok",
    visual: "root",
    status: "draft",
    isDemo: true,
  });
  const [draftProduct] = await db.select().from(schema.products).where(eq(schema.products.slug, "dried-ginger-kavre"));
  await db.insert(schema.productVariants).values({ productId: draftProduct!.id, label: "200 g", sku: "DEMO-GIN-200", weightGrams: 200, basePriceMinor: npr(300), stock: 0, isDefault: true });

  /* ── Sample order requests ─────────────────────────────────────── */
  const allVariants = await db.query.productVariants.findMany({ with: { product: { columns: { name: true }, with: { primaryBatch: { columns: { code: true } } } } } });
  const v = (sku: string) => allVariants.find((x) => x.sku === sku)!;
  const sampleOrders = [
    { number: "HV-2610-1042", name: "Sample customer A", email: "sample-a@example.com", country: "NP", city: "Lalitpur", currency: "NPR", rate: 1, status: "confirmed" as const, lines: [["DEMO-TUR-500", 2], ["DEMO-TEA-100", 1]] as const, at: "2026-10-06" },
    { number: "HV-2610-1057", name: "Sample customer B", email: "sample-b@example.com", country: "US", city: "Greensboro", currency: "USD", rate: 1 / 140, status: "requested" as const, lines: [["DEMO-CAR-100", 3], ["DEMO-TIM-050", 2]] as const, at: "2026-10-11" },
    { number: "HV-2610-1063", name: "Sample customer C", email: "sample-c@example.com", country: "GB", city: "London", currency: "GBP", rate: 1 / 186, status: "packed" as const, lines: [["DEMO-RIC-1KG", 2]] as const, at: "2026-10-12" },
  ];
  for (const o of sampleOrders) {
    const items = o.lines.map(([sku, qty]) => {
      const vr = v(sku);
      const regional = o.currency === "USD" && sku === "DEMO-CAR-100" ? 450 : null;
      const display = o.currency === "NPR" ? vr.basePriceMinor : regional ?? Math.round((vr.basePriceMinor / 100) * o.rate * 100);
      return { vr, qty, display };
    });
    const [order] = await db
      .insert(schema.orders)
      .values({
        number: o.number,
        status: o.status,
        customerName: o.name,
        email: o.email,
        country: o.country,
        city: o.city,
        displayCurrency: o.currency,
        fxRatePerNpr: o.rate.toFixed(10),
        subtotalMinor: items.reduce((s, i) => s + i.vr.basePriceMinor * i.qty, 0),
        displaySubtotalMinor: items.reduce((s, i) => s + i.display * i.qty, 0),
        createdAt: d(o.at),
        isDemo: true,
      })
      .returning();
    await db.insert(schema.orderItems).values(
      items.map((i) => ({
        orderId: order!.id,
        variantId: i.vr.id,
        productName: i.vr.product.name,
        variantLabel: i.vr.label,
        batchCode: i.vr.product.primaryBatch?.code ?? null,
        quantity: i.qty,
        unitPriceMinor: i.vr.basePriceMinor,
        displayUnitPriceMinor: i.display,
      })),
    );
  }

  await db.insert(schema.auditLogs).values({
    actorLabel: "System",
    action: "demo.seed",
    entityType: "system",
    summary: "Demonstration scenario loaded (all records flagged as sample data)",
  });

  console.log(`✓ seeded ${chains.length} traced products, ${farmerDefs.length} sample producers, ${centers.length} sample centres, ${sampleOrders.length} sample orders`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
