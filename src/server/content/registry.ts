/**
 * Website content registry — the single list of everything editable in
 * HIMVEDA Studio / inline edit mode. A key must be declared here before it can
 * be stored, which keeps inline editing from writing arbitrary data.
 *
 * Defaults contain NO invented business facts: no customer numbers, no
 * certifications, no history, no contact details. Unknown facts default to
 * empty and their UI is simply not rendered until the owner fills them in.
 */

export type ContentKind = "text" | "richtext" | "image" | "link" | "json" | "boolean";

export interface LinkValue {
  label: string;
  href: string;
}
export interface FaqItem {
  q: string;
  a: string;
}
export interface SocialLink {
  network: string;
  href: string;
}
export interface Audience {
  who: string;
  line: string;
  cta: LinkValue;
}
export interface ChainStep {
  key: string;
  name: string;
  nameNe: string;
  title: string;
  body: string;
  recorded: string[];
}

interface Def<T, K extends ContentKind = ContentKind> {
  kind: K;
  label: string;
  group: string;
  default: T;
  max?: number;
  help?: string;
}

const text = (group: string, label: string, def: string, max = 280, help?: string): Def<string, "text"> => ({
  kind: "text",
  group,
  label,
  default: def,
  max,
  help,
});
const rich = (group: string, label: string, def: string, max = 20000, help?: string): Def<string, "richtext"> => ({
  kind: "richtext",
  group,
  label,
  default: def,
  max,
  help,
});
const link = (group: string, label: string, def: LinkValue): Def<LinkValue, "link"> => ({ kind: "link", group, label, default: def });
const image = (group: string, label: string): Def<string | null, "image"> => ({ kind: "image", group, label, default: null });
const bool = (group: string, label: string, def: boolean, help?: string): Def<boolean, "boolean"> => ({
  kind: "boolean",
  group,
  label,
  default: def,
  help,
});
function json<T>(group: string, label: string, def: T, help?: string): Def<T, "json"> {
  return { kind: "json", group, label, default: def, help };
}

export const CONTENT = {
  /* Settings */
  "settings.demoMode": bool(
    "Settings",
    "Demonstration mode",
    true,
    "Shows a site-wide notice that sample data is on display and labels every sample record. Turn off once real products are live.",
  ),
  "announcement.enabled": bool("Announcement", "Show announcement bar", false),
  "announcement.text": text("Announcement", "Announcement text", "", 140),
  "announcement.link": link("Announcement", "Announcement link", { label: "", href: "" }),

  /* SEO */
  "seo.title": text("SEO", "Default page title", "HIMVEDA — Traceable produce from Nepal", 70),
  "seo.description": text(
    "SEO",
    "Default meta description",
    "HIMVEDA connects Nepali producers, collection centres and buyers through one traceable record — from the field it grew in to the order it fills.",
    170,
  ),

  /* Navigation & footer */
  "nav.items": json<LinkValue[]>("Navigation", "Main navigation", [
    { label: "Market", href: "/market" },
    { label: "Traceability", href: "/trace" },
    { label: "Producers", href: "/producers" },
    { label: "Company", href: "/company" },
  ]),
  "footer.statement": text(
    "Footer",
    "Footer statement",
    "Produce from Nepal, with its record attached.",
    160,
  ),

  /* Home — hero */
  "home.hero.batch": text(
    "Home · Hero",
    "Featured batch code",
    "",
    20,
    "Batch shown on the hero map, e.g. HIM-26-TPJ-00217. Leave empty to use the most recent public batch.",
  ),
  "home.hero.title": text("Home · Hero", "Headline", "Every harvest, accounted for.", 90),
  "home.hero.lede": text(
    "Home · Hero",
    "Lede",
    "HIMVEDA is building a traceable path for Nepali produce: weighed at the collection centre, checked before purchase, processed in recorded batches and sold with its journey attached.",
    320,
  ),
  "home.hero.primary": link("Home · Hero", "Primary action", { label: "Explore the market", href: "/market" }),
  "home.hero.secondary": link("Home · Hero", "Secondary action", { label: "Trace a batch", href: "/trace" }),

  /* Home — ecosystem */
  "home.ecosystem.kicker": text("Home · Ecosystem", "Kicker", "The HIMVEDA system", 60),
  "home.ecosystem.title": text(
    "Home · Ecosystem",
    "Statement",
    "Most produce loses its story the moment it leaves the farm. HIMVEDA keeps it.",
    160,
  ),
  "home.ecosystem.body": text(
    "Home · Ecosystem",
    "Body",
    "Producers deliver to physical collection centres. Each delivery is weighed, inspected and recorded before it is bought. Accepted produce moves into processing as a numbered batch — and that batch number travels with every pack to the buyer.",
    600,
  ),

  /* Home — chain story */
  "home.chain.kicker": text("Home · Chain", "Kicker", "From field to market", 60),
  "home.chain.title": text("Home · Chain", "Title", "Five checkpoints. One continuous record.", 120),
  "home.chain.steps": json<ChainStep[]>("Home · Chain", "Checkpoints", [
    {
      key: "farm",
      name: "Field",
      nameNe: "खेत",
      title: "It starts with a named place",
      body: "Every lot is linked to a registered producer and an approximate farm location — district, altitude and harvest date — before it travels anywhere.",
      recorded: ["Producer ID", "District & altitude", "Harvest date"],
    },
    {
      key: "collection",
      name: "Collection",
      nameNe: "सङ्कलन",
      title: "Weighed where it is delivered",
      body: "At the collection centre the delivery is weighed gross and net, and the producer receives a numbered receipt for exactly what was handed over.",
      recorded: ["Receipt number", "Gross & net weight", "Collection centre"],
    },
    {
      key: "verify",
      name: "Verification",
      nameNe: "प्रमाणीकरण",
      title: "Checked before it is bought",
      body: "Moisture, foreign matter and visual grade are recorded at inspection. Only the accepted quantity is purchased, at the rate approved for that centre.",
      recorded: ["Moisture %", "Foreign matter %", "Grade & accepted weight"],
    },
    {
      key: "process",
      name: "Processing",
      nameNe: "प्रशोधन",
      title: "Processed as one numbered batch",
      body: "Accepted lots are combined into a batch with a permanent code. Drying, grading and packing runs are logged with input and output weights.",
      recorded: ["Batch code", "Input → output weight", "Pack count"],
    },
    {
      key: "market",
      name: "Market",
      nameNe: "बजार",
      title: "Sold with its record attached",
      body: "The batch code is printed on the pack and published at /trace — so a buyer can see where it came from, without exposing anyone's private details.",
      recorded: ["Public trace page", "Stock by batch", "Order line"],
    },
  ]),

  /* Home — producers */
  "home.producers.kicker": text("Home · Producers", "Kicker", "For producers", 60),
  "home.producers.title": text(
    "Home · Producers",
    "Title",
    "A receipt for every kilogram delivered.",
    120,
  ),
  "home.producers.body": text(
    "Home · Producers",
    "Body",
    "Producers see the measured weight, the inspection result, the approved rate and the payment record for each delivery. Nothing about the transaction depends on memory or a handwritten note.",
    600,
  ),

  /* Home — network */
  "home.network.kicker": text("Home · Network", "Kicker", "Collection network", 60),
  "home.network.title": text("Home · Network", "Title", "Physical centres, close to where things grow.", 120),
  "home.network.body": text(
    "Home · Network",
    "Body",
    "Collection centres are the first point of verification. Each has its own code, which becomes part of every batch number it originates.",
    500,
  ),

  /* Home — quality */
  "home.quality.kicker": text("Home · Quality", "Kicker", "Quality & verification", 60),
  "home.quality.title": text("Home · Quality", "Title", "We publish what we measured — and nothing we didn't.", 140),
  "home.quality.body": text(
    "Home · Quality",
    "Body",
    "Inspection results appear on the trace page as recorded. Laboratory results are shown only when a real report exists for that batch; certifications are shown only once the certificate is on file.",
    500,
  ),

  /* Home — market */
  "home.market.kicker": text("Home · Market", "Kicker", "The market", 60),
  "home.market.title": text("Home · Market", "Title", "Available now, batch by batch.", 120),

  /* Home — trace */
  "home.trace.kicker": text("Home · Trace", "Kicker", "Try it", 60),
  "home.trace.title": text("Home · Trace", "Title", "Every pack carries a code. Follow one.", 120),
  "home.trace.body": text(
    "Home · Trace",
    "Body",
    "Enter the batch code printed on a HIMVEDA pack to see its journey — origin district, collection, inspection, processing and availability.",
    400,
  ),

  /* Home — technology */
  "home.tech.kicker": text("Home · Technology", "Kicker", "HIMVEDA technology", 60),
  "home.tech.title": text("Home · Technology", "Title", "One ledger, from weigh-in to order.", 120),
  "home.tech.body": text(
    "Home · Technology",
    "Body",
    "Receipts, inspections, procurement, processing, inventory, orders and payments share a single relational record. Every change is attributed and time-stamped, so the public trace is a view of the operating data — not marketing copy written after the fact.",
    600,
  ),

  /* Home — audiences */
  "home.audiences.title": text("Home · Audiences", "Title", "Work with HIMVEDA", 80),
  "home.audiences.items": json<Audience[]>("Home · Audiences", "Audiences", [
    {
      who: "Producers & cooperatives",
      line: "Deliver to a collection centre and get a transparent, recorded transaction.",
      cta: { label: "How it works for producers", href: "/producers" },
    },
    {
      who: "Buyers & retailers",
      line: "Source Nepali produce by the batch, with its origin and checks on record.",
      cta: { label: "Browse the market", href: "/market" },
    },
    {
      who: "Partners & distributors",
      line: "Collection points, logistics and outlets that want to join the chain.",
      cta: { label: "Start a conversation", href: "/contact?topic=partnership" },
    },
  ]),

  /* Company & owner */
  "company.kicker": text("Company", "Kicker", "Company", 60),
  "company.title": text("Company", "Title", "HIMVEDA", 80),
  "company.intro": text(
    "Company",
    "Introduction",
    "HIMVEDA is a Nepal-focused agricultural procurement, marketplace and traceability business. This page will carry the company's verified background as it is published.",
    800,
    "Keep this factual. Add history, registration details and milestones only once confirmed.",
  ),
  "owner.name": text("Owner", "Owner name", "Madhav Dhungel", 80),
  "owner.title": text("Owner", "Owner title", "Owner, HIMVEDA", 80),
  "owner.bio": rich("Owner", "Owner biography", "", 4000, "Leave empty until the owner has written or approved it."),
  "owner.image": image("Owner", "Owner portrait"),

  /* Producers page */
  "producers.title": text("Producers page", "Title", "Deliver once. Get a record of everything.", 120),
  "producers.body": text(
    "Producers page",
    "Body",
    "HIMVEDA works through physical collection centres. Bring your produce, and every step that follows is written down — for you and for us.",
    600,
  ),

  /* Contact */
  "contact.title": text("Contact", "Title", "Talk to HIMVEDA", 80),
  "contact.body": text(
    "Contact",
    "Intro",
    "For orders, partnerships, collection centres or wholesale enquiries, send a message and it reaches the HIMVEDA team directly.",
    400,
  ),
  "contact.email": text("Contact", "Email", "", 120),
  "contact.phone": text("Contact", "Phone", "", 40),
  "contact.whatsapp": text("Contact", "WhatsApp number", "", 40),
  "contact.address": text("Contact", "Business address", "", 300),
  "contact.hours": text("Contact", "Hours", "", 160),
  "social.links": json<SocialLink[]>("Contact", "Social links", []),

  /* FAQ */
  "faq.items": json<FaqItem[]>("FAQ", "Questions", [
    {
      q: "Why do some prices start with “≈”?",
      a: "HIMVEDA prices every product in Nepalese rupees. If you are viewing the site in another currency, the amount is converted for convenience and marked “≈”. Prices without “≈” were set directly in that currency. Your order is recorded in NPR, and the amount to pay is confirmed with you before payment.",
    },
    {
      q: "How is my currency chosen?",
      a: "We use your approximate location where the hosting platform provides it, otherwise a rough estimate from your device's time zone, otherwise Nepalese rupees. You can always change it with the currency selector — your choice is remembered on this device.",
    },
    {
      q: "What is a batch code?",
      a: "A batch code such as HIM-26-ILM-00482 identifies one processed lot. It encodes the year, the collection centre and a sequence number. Enter it at /trace to see that batch's journey.",
    },
    {
      q: "How does ordering work?",
      a: "Add items to your cart and send an order request. HIMVEDA confirms availability, delivery and payment details with you directly before anything is charged.",
    },
    {
      q: "Do you share producers' personal details?",
      a: "No. Trace pages show the district and approximate location of origin. A producer's name is shown only if they have agreed to it; contact details and payments are never public.",
    },
  ]),

  /* Legal (owner must complete) */
  "legal.privacy": rich(
    "Legal",
    "Privacy policy",
    [
      "## What this website stores",
      "",
      "- **Your currency choice.** A cookie (`hv_currency`) and your browser's local storage remember the currency you picked. An approximate country (`hv_geo`) may be stored to choose a default currency. We never store your precise location.",
      "- **Your cart.** Items you add are kept in your browser's local storage until you send an order request.",
      "- **Order requests.** When you send one we store your name, email, phone (optional), delivery country, city and address so HIMVEDA can confirm and fulfil the order.",
      "- **Contact messages.** Messages sent through the contact form are stored so the team can reply.",
      "",
      "We do not run advertising trackers on this site and we do not sell personal data.",
      "",
      "_This summary describes how the website software behaves. The business's full privacy policy is being finalised by HIMVEDA._",
    ].join("\n"),
  ),
  "legal.terms": rich(
    "Legal",
    "Terms of sale",
    "HIMVEDA's terms of sale are being finalised. Until they are published, every order is confirmed individually — including price, delivery and payment — before anything is charged.",
  ),
  "legal.shipping": rich(
    "Legal",
    "Delivery & returns",
    "Delivery options, costs and timelines are confirmed with you for each order before payment. HIMVEDA's published delivery and returns policy is being finalised.",
  ),
} satisfies Record<string, Def<unknown, ContentKind>>;

export type ContentKey = keyof typeof CONTENT;
export type ContentValue<K extends ContentKey> = (typeof CONTENT)[K]["default"];
export type ContentMap = { [K in ContentKey]: ContentValue<K> };

export function isContentKey(k: string): k is ContentKey {
  return Object.prototype.hasOwnProperty.call(CONTENT, k);
}
