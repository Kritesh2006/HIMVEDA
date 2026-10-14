/**
 * HIMVEDA relational schema (PostgreSQL, Drizzle ORM).
 *
 * Conventions
 * - Money is stored as integer minor units (NPR paisa, USD cents …) with an
 *   explicit ISO-4217 currency column. NPR is the canonical currency.
 * - Weights are stored in grams (integer) to avoid float drift.
 * - Every entity that can contain demonstration data carries `is_demo` so the
 *   UI can label it and Studio can purge it in one action.
 * - Public/private split: anything a visitor may see is explicitly flagged
 *   (`is_public`, `publish_name`, `public_*` columns). Default is private.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  customType,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const isDemo = () => boolean("is_demo").notNull().default(false);

/* ───────────────────────────── Enums ───────────────────────────── */

export const userRole = pgEnum("user_role", ["owner", "editor"]);
export const productStatus = pgEnum("product_status", ["draft", "published", "archived"]);
export const verificationStatus = pgEnum("verification_status", ["unverified", "pending", "verified"]);
export const qualityGrade = pgEnum("quality_grade", ["A", "B", "C", "ungraded"]);
export const receiptStatus = pgEnum("receipt_status", ["received", "inspected", "accepted", "rejected", "procured"]);
export const inspectionResult = pgEnum("inspection_result", ["pass", "hold", "fail"]);
export const batchStage = pgEnum("batch_stage", [
  "origin",
  "collected",
  "inspected",
  "verified",
  "processed",
  "packaged",
  "available",
  "sold_out",
]);
export const locationKind = pgEnum("location_kind", ["collection_center", "warehouse", "processing", "outlet"]);
export const orderStatus = pgEnum("order_status", [
  "requested",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
]);
export const paymentStatus = pgEnum("payment_status", ["pending", "approved", "paid", "void"]);
export const approvalStatus = pgEnum("approval_status", ["pending", "approved", "rejected"]);
export const pricingRuleKind = pgEnum("pricing_rule_kind", ["display_rounding", "procurement_rate"]);
export const roundingMode = pgEnum("rounding_mode", ["none", "whole", "half", "charm_99"]);
export const contentKind = pgEnum("content_kind", ["text", "richtext", "image", "link", "json"]);

/* ─────────────────────── Identity & security ─────────────────────── */

export const users = pgTable("users", {
  id: id(),
  displayName: text("display_name").notNull(),
  role: userRole("role").notNull().default("editor"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** One row per authorised access code. Only a salted, peppered scrypt hash is stored. */
export const adminCredentials = pgTable(
  "admin_credentials",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(), // "Editor 1" — never shown publicly
    slot: integer("slot").notNull(), // 1..n, maps to ADMIN_CODE_<slot> at registration
    salt: text("salt").notNull(),
    codeHash: text("code_hash").notNull(),
    active: boolean("active").notNull().default(true),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("admin_credentials_slot_uq").on(t.slot)],
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: id(),
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    credentialId: uuid("credential_id").references(() => adminCredentials.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
  },
  (t) => [uniqueIndex("admin_sessions_token_uq").on(t.tokenHash), index("admin_sessions_user_idx").on(t.userId)],
);

/** Append-only log of access attempts, used for throttling and lockouts. */
export const accessAttempts = pgTable(
  "access_attempts",
  {
    id: id(),
    sourceHash: text("source_hash").notNull(), // HMAC(ip) — raw IPs are never stored
    success: boolean("success").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("access_attempts_source_idx").on(t.sourceHash, t.createdAt), index("access_attempts_time_idx").on(t.createdAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorLabel: text("actor_label").notNull(),
    action: text("action").notNull(), // e.g. product.price.update
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    summary: text("summary").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_time_idx").on(t.createdAt), index("audit_logs_entity_idx").on(t.entityType, t.entityId)],
);

/* ─────────────────────────── Media ─────────────────────────── */

export const media = pgTable("media", {
  id: id(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  width: integer("width"),
  height: integer("height"),
  alt: text("alt").notNull().default(""),
  credit: text("credit"),
  /** Bytes live in Postgres by default (zero extra services). See docs/ARCHITECTURE.md. */
  data: bytea("data"),
  /** Alternatively an external URL (object storage / CDN). */
  externalUrl: text("external_url"),
  isDemo: isDemo(),
  createdAt: createdAt(),
});

/* ─────────────────────────── Catalog ─────────────────────────── */

export const categories = pgTable(
  "categories",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    nameNe: text("name_ne"),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("categories_slug_uq").on(t.slug)],
);

export type ProductDraft = Record<string, unknown>;

export const products = pgTable(
  "products",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    shortDescription: text("short_description").notNull().default(""),
    description: text("description").notNull().default(""),
    unit: text("unit").notNull().default("pack"),
    originCountry: text("origin_country").notNull().default("Nepal"),
    district: text("district"),
    producerId: uuid("producer_id").references(() => farmers.id, { onDelete: "set null" }),
    collectionCenterId: uuid("collection_center_id").references(() => collectionCenters.id, { onDelete: "set null" }),
    primaryBatchId: uuid("primary_batch_id"),
    harvestDate: date("harvest_date"),
    qualityGrade: qualityGrade("quality_grade").notNull().default("ungraded"),
    verificationStatus: verificationStatus("verification_status").notNull().default("unverified"),
    processingInfo: text("processing_info"),
    visual: text("visual").notNull().default("leaf"), // generative specimen illustration key
    featured: boolean("featured").notNull().default(false),
    status: productStatus("status").notNull().default("draft"),
    /** Pending edits for a published product (Save Draft → Preview → Publish). */
    draft: jsonb("draft").$type<ProductDraft | null>(),
    draftUpdatedAt: timestamp("draft_updated_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("products_slug_uq").on(t.slug),
    index("products_status_idx").on(t.status),
    index("products_category_idx").on(t.categoryId),
  ],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    label: text("label").notNull(), // "250 g"
    sku: text("sku").notNull(),
    weightGrams: integer("weight_grams"),
    /** THE canonical price. Every surface derives from this. */
    basePriceMinor: integer("base_price_minor").notNull(), // NPR paisa
    stock: integer("stock").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("product_variants_sku_uq").on(t.sku), index("product_variants_product_idx").on(t.productId)],
);

/** Intentional per-currency prices. Take priority over automatic conversion. */
export const regionalPrices = pgTable(
  "regional_prices",
  {
    id: id(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    currency: text("currency").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("regional_prices_variant_currency_uq").on(t.variantId, t.currency)],
);

export const productMedia = pgTable(
  "product_media",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.mediaId] })],
);

/* ─────────────────────────── Currency ─────────────────────────── */

/** Units of `currency` per 1 NPR. Latest row per currency wins. */
export const currencyRates = pgTable(
  "currency_rates",
  {
    id: id(),
    currency: text("currency").notNull(),
    ratePerNpr: numeric("rate_per_npr", { precision: 18, scale: 10 }).notNull(),
    source: text("source").notNull(), // "dev-static" | provider name
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("currency_rates_currency_uq").on(t.currency)],
);

export const pricingRules = pgTable("pricing_rules", {
  id: id(),
  kind: pricingRuleKind("kind").notNull(),
  name: text("name").notNull(),
  currency: text("currency"), // display_rounding: target currency
  rounding: roundingMode("rounding").notNull().default("none"),
  commodity: text("commodity"), // procurement_rate: commodity
  collectionCenterId: uuid("collection_center_id").references(() => collectionCenters.id, { onDelete: "cascade" }),
  ratePerKgMinor: integer("rate_per_kg_minor"), // procurement_rate: NPR paisa / kg
  gradeMultipliers: jsonb("grade_multipliers").$type<Record<string, number>>(),
  active: boolean("active").notNull().default(true),
  isDemo: isDemo(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Controlled pricing: procurement rate changes require a second approval. */
export const priceApprovals = pgTable("price_approvals", {
  id: id(),
  pricingRuleId: uuid("pricing_rule_id")
    .notNull()
    .references(() => pricingRules.id, { onDelete: "cascade" }),
  previousMinor: integer("previous_minor"),
  proposedMinor: integer("proposed_minor").notNull(),
  note: text("note"),
  status: approvalStatus("status").notNull().default("pending"),
  requestedById: uuid("requested_by_id").references(() => users.id, { onDelete: "set null" }),
  decidedById: uuid("decided_by_id").references(() => users.id, { onDelete: "set null" }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  isDemo: isDemo(),
  createdAt: createdAt(),
});

/* ─────────────────────── Producers & network ─────────────────────── */

export const farmers = pgTable(
  "farmers",
  {
    id: id(),
    code: text("code").notNull(), // FMR-0001
    fullName: text("full_name").notNull(), // private
    publicName: text("public_name"), // shown only if publishConsent
    publishConsent: boolean("publish_consent").notNull().default(false),
    phone: text("phone"), // private
    district: text("district").notNull(),
    municipality: text("municipality"),
    cooperative: text("cooperative"),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("farmers_code_uq").on(t.code)],
);

export const farms = pgTable("farms", {
  id: id(),
  farmerId: uuid("farmer_id")
    .notNull()
    .references(() => farmers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  district: text("district").notNull(),
  altitudeM: integer("altitude_m"),
  areaRopani: numeric("area_ropani", { precision: 10, scale: 2 }),
  /** Approximate (≈ ward-level) coordinates only — never a household location. */
  approxLat: numeric("approx_lat", { precision: 8, scale: 4 }),
  approxLng: numeric("approx_lng", { precision: 8, scale: 4 }),
  crops: text("crops").array().notNull().default(sql`ARRAY[]::text[]`),
  isDemo: isDemo(),
  createdAt: createdAt(),
});

export const collectionCenters = pgTable(
  "collection_centers",
  {
    id: id(),
    code: text("code").notNull(), // ILM — used in batch IDs
    name: text("name").notNull(),
    district: text("district").notNull(),
    province: text("province"),
    lat: numeric("lat", { precision: 8, scale: 4 }),
    lng: numeric("lng", { precision: 8, scale: 4 }),
    address: text("address"),
    openingNotes: text("opening_notes"),
    isPublic: boolean("is_public").notNull().default(false),
    active: boolean("active").notNull().default(true),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("collection_centers_code_uq").on(t.code)],
);

export const inventoryLocations = pgTable(
  "inventory_locations",
  {
    id: id(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    kind: locationKind("kind").notNull(),
    district: text("district"),
    collectionCenterId: uuid("collection_center_id").references(() => collectionCenters.id, { onDelete: "set null" }),
    isDemo: isDemo(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("inventory_locations_code_uq").on(t.code)],
);

/* ───────────────────── Collection → procurement ───────────────────── */

export const collectionReceipts = pgTable(
  "collection_receipts",
  {
    id: id(),
    receiptNo: text("receipt_no").notNull(),
    farmerId: uuid("farmer_id")
      .notNull()
      .references(() => farmers.id, { onDelete: "restrict" }),
    farmId: uuid("farm_id").references(() => farms.id, { onDelete: "set null" }),
    collectionCenterId: uuid("collection_center_id")
      .notNull()
      .references(() => collectionCenters.id, { onDelete: "restrict" }),
    commodity: text("commodity").notNull(),
    harvestDate: date("harvest_date"),
    grossGrams: integer("gross_grams").notNull(),
    tareGrams: integer("tare_grams").notNull().default(0),
    netGrams: integer("net_grams").notNull(),
    moisturePct: numeric("moisture_pct", { precision: 5, scale: 2 }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    receivedBy: text("received_by"),
    status: receiptStatus("status").notNull().default("received"),
    notes: text("notes"),
    isDemo: isDemo(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("collection_receipts_no_uq").on(t.receiptNo), index("collection_receipts_farmer_idx").on(t.farmerId)],
);

export const inspections = pgTable("inspections", {
  id: id(),
  receiptId: uuid("receipt_id")
    .notNull()
    .references(() => collectionReceipts.id, { onDelete: "cascade" }),
  inspectedAt: timestamp("inspected_at", { withTimezone: true }).notNull(),
  inspector: text("inspector"),
  visualGrade: qualityGrade("visual_grade").notNull().default("ungraded"),
  moisturePct: numeric("moisture_pct", { precision: 5, scale: 2 }),
  foreignMatterPct: numeric("foreign_matter_pct", { precision: 5, scale: 2 }),
  acceptedGrams: integer("accepted_grams"),
  result: inspectionResult("result").notNull(),
  notes: text("notes"),
  isDemo: isDemo(),
  createdAt: createdAt(),
});

export const procurements = pgTable(
  "procurements",
  {
    id: id(),
    receiptId: uuid("receipt_id")
      .notNull()
      .references(() => collectionReceipts.id, { onDelete: "restrict" }),
    pricingRuleId: uuid("pricing_rule_id").references(() => pricingRules.id, { onDelete: "set null" }),
    acceptedGrams: integer("accepted_grams").notNull(),
    ratePerKgMinor: integer("rate_per_kg_minor").notNull(),
    totalMinor: integer("total_minor").notNull(),
    procuredAt: timestamp("procured_at", { withTimezone: true }).notNull(),
    isDemo: isDemo(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("procurements_receipt_uq").on(t.receiptId)],
);

export const farmerPayments = pgTable("farmer_payments", {
  id: id(),
  farmerId: uuid("farmer_id")
    .notNull()
    .references(() => farmers.id, { onDelete: "restrict" }),
  procurementId: uuid("procurement_id").references(() => procurements.id, { onDelete: "set null" }),
  amountMinor: integer("amount_minor").notNull(),
  method: text("method"), // bank / wallet / cash — free text, owner-defined
  reference: text("reference"),
  status: paymentStatus("status").notNull().default("pending"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  isDemo: isDemo(),
  createdAt: createdAt(),
});

/* ───────────────────── Batches, processing, trace ───────────────────── */

export const batches = pgTable(
  "batches",
  {
    id: id(),
    code: text("code").notNull(), // HIM-26-ILM-00482
    commodity: text("commodity").notNull(),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    collectionCenterId: uuid("collection_center_id").references(() => collectionCenters.id, { onDelete: "set null" }),
    originDistrict: text("origin_district"),
    harvestDate: date("harvest_date"),
    stage: batchStage("stage").notNull().default("collected"),
    inputGrams: integer("input_grams"),
    outputGrams: integer("output_grams"),
    unitsPacked: integer("units_packed"),
    qualityGrade: qualityGrade("quality_grade").notNull().default("ungraded"),
    publicSummary: text("public_summary"),
    isPublic: boolean("is_public").notNull().default(false),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("batches_code_uq").on(t.code)],
);

export const batchReceipts = pgTable(
  "batch_receipts",
  {
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    receiptId: uuid("receipt_id")
      .notNull()
      .references(() => collectionReceipts.id, { onDelete: "restrict" }),
  },
  (t) => [primaryKey({ columns: [t.batchId, t.receiptId] })],
);

export const qualityTests = pgTable("quality_tests", {
  id: id(),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => batches.id, { onDelete: "cascade" }),
  testType: text("test_type").notNull(), // moisture, foreign matter, aflatoxin …
  method: text("method"),
  resultValue: numeric("result_value", { precision: 12, scale: 4 }),
  resultUnit: text("result_unit"),
  limitText: text("limit_text"),
  passed: boolean("passed").notNull(),
  performedBy: text("performed_by"), // "In-house" or the lab's name — only if real
  testedAt: timestamp("tested_at", { withTimezone: true }).notNull(),
  /** Link to a real certificate. Never fabricated; empty until a document exists. */
  documentMediaId: uuid("document_media_id").references(() => media.id, { onDelete: "set null" }),
  isPublic: boolean("is_public").notNull().default(true),
  isDemo: isDemo(),
  createdAt: createdAt(),
});

export const processingRuns = pgTable("processing_runs", {
  id: id(),
  code: text("code").notNull(),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => batches.id, { onDelete: "cascade" }),
  locationId: uuid("location_id").references(() => inventoryLocations.id, { onDelete: "set null" }),
  process: text("process").notNull(), // drying, grading, grinding, packing
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  inputGrams: integer("input_grams").notNull(),
  outputGrams: integer("output_grams"),
  notes: text("notes"),
  isDemo: isDemo(),
  createdAt: createdAt(),
});

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: id(),
    batchId: uuid("batch_id").references(() => batches.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    fromLocationId: uuid("from_location_id").references(() => inventoryLocations.id, { onDelete: "set null" }),
    toLocationId: uuid("to_location_id").references(() => inventoryLocations.id, { onDelete: "set null" }),
    quantity: integer("quantity").notNull(),
    quantityUnit: text("quantity_unit").notNull(), // "g" | "unit"
    reason: text("reason").notNull(), // transfer, stock_adjustment, sale, receipt
    reference: text("reference"),
    actorLabel: text("actor_label"),
    movedAt: timestamp("moved_at", { withTimezone: true }).notNull().defaultNow(),
    isDemo: isDemo(),
  },
  (t) => [index("inventory_movements_batch_idx").on(t.batchId), index("inventory_movements_variant_idx").on(t.variantId)],
);

export const traceabilityEvents = pgTable(
  "traceability_events",
  {
    id: id(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    stage: batchStage("stage").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    title: text("title").notNull(),
    publicDescription: text("public_description"),
    privateNotes: text("private_notes"),
    locationLabel: text("location_label"),
    district: text("district"),
    lat: numeric("lat", { precision: 8, scale: 4 }),
    lng: numeric("lng", { precision: 8, scale: 4 }),
    /** Public-safe metrics only, e.g. { netKg: 412.6, moisturePct: 9.8 } */
    metrics: jsonb("metrics").$type<Record<string, number | string>>(),
    isPublic: boolean("is_public").notNull().default(true),
    isDemo: isDemo(),
    createdAt: createdAt(),
  },
  (t) => [index("traceability_events_batch_idx").on(t.batchId, t.occurredAt)],
);

/* ─────────────────────────── Commerce ─────────────────────────── */

export const orders = pgTable(
  "orders",
  {
    id: id(),
    number: text("number").notNull(), // HV-2610-0042
    status: orderStatus("status").notNull().default("requested"),
    customerName: text("customer_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    country: text("country").notNull(),
    city: text("city"),
    address: text("address"),
    notes: text("notes"),
    displayCurrency: text("display_currency").notNull(),
    fxRatePerNpr: numeric("fx_rate_per_npr", { precision: 18, scale: 10 }),
    subtotalMinor: integer("subtotal_minor").notNull(), // NPR — the amount of record
    displaySubtotalMinor: integer("display_subtotal_minor").notNull(),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("orders_number_uq").on(t.number)],
);

export const orderItems = pgTable("order_items", {
  id: id(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  variantLabel: text("variant_label").notNull(),
  batchCode: text("batch_code"),
  quantity: integer("quantity").notNull(),
  unitPriceMinor: integer("unit_price_minor").notNull(), // NPR
  displayUnitPriceMinor: integer("display_unit_price_minor").notNull(),
});

export const contactMessages = pgTable("contact_messages", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  topic: text("topic").notNull(),
  message: text("message").notNull(),
  handled: boolean("handled").notNull().default(false),
  createdAt: createdAt(),
});

/* ─────────────────────────── Website CMS ─────────────────────────── */

export const siteContent = pgTable(
  "site_content",
  {
    key: text("key").primaryKey(), // "home.hero.title"
    kind: contentKind("kind").notNull().default("text"),
    value: jsonb("value").notNull(),
    draftValue: jsonb("draft_value"),
    updatedAt: updatedAt(),
    updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  },
);

/* ─────────────────────────── Relations ─────────────────────────── */

export const usersRelations = relations(users, ({ many }) => ({
  credentials: many(adminCredentials),
  sessions: many(adminSessions),
}));
export const adminCredentialsRelations = relations(adminCredentials, ({ one }) => ({
  user: one(users, { fields: [adminCredentials.userId], references: [users.id] }),
}));
export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
  user: one(users, { fields: [adminSessions.userId], references: [users.id] }),
  credential: one(adminCredentials, { fields: [adminSessions.credentialId], references: [adminCredentials.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({ products: many(products) }));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  producer: one(farmers, { fields: [products.producerId], references: [farmers.id] }),
  collectionCenter: one(collectionCenters, { fields: [products.collectionCenterId], references: [collectionCenters.id] }),
  primaryBatch: one(batches, { fields: [products.primaryBatchId], references: [batches.id] }),
  variants: many(productVariants),
  media: many(productMedia),
}));

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
  regionalPrices: many(regionalPrices),
}));
export const regionalPricesRelations = relations(regionalPrices, ({ one }) => ({
  variant: one(productVariants, { fields: [regionalPrices.variantId], references: [productVariants.id] }),
}));
export const productMediaRelations = relations(productMedia, ({ one }) => ({
  product: one(products, { fields: [productMedia.productId], references: [products.id] }),
  media: one(media, { fields: [productMedia.mediaId], references: [media.id] }),
}));

export const farmersRelations = relations(farmers, ({ many }) => ({
  farms: many(farms),
  receipts: many(collectionReceipts),
  payments: many(farmerPayments),
}));
export const farmsRelations = relations(farms, ({ one }) => ({
  farmer: one(farmers, { fields: [farms.farmerId], references: [farmers.id] }),
}));
export const collectionCentersRelations = relations(collectionCenters, ({ many }) => ({
  receipts: many(collectionReceipts),
  batches: many(batches),
}));

export const collectionReceiptsRelations = relations(collectionReceipts, ({ one, many }) => ({
  farmer: one(farmers, { fields: [collectionReceipts.farmerId], references: [farmers.id] }),
  farm: one(farms, { fields: [collectionReceipts.farmId], references: [farms.id] }),
  collectionCenter: one(collectionCenters, {
    fields: [collectionReceipts.collectionCenterId],
    references: [collectionCenters.id],
  }),
  inspections: many(inspections),
  procurement: one(procurements),
  batchLinks: many(batchReceipts),
}));
export const inspectionsRelations = relations(inspections, ({ one }) => ({
  receipt: one(collectionReceipts, { fields: [inspections.receiptId], references: [collectionReceipts.id] }),
}));
export const procurementsRelations = relations(procurements, ({ one, many }) => ({
  receipt: one(collectionReceipts, { fields: [procurements.receiptId], references: [collectionReceipts.id] }),
  pricingRule: one(pricingRules, { fields: [procurements.pricingRuleId], references: [pricingRules.id] }),
  payments: many(farmerPayments),
}));
export const farmerPaymentsRelations = relations(farmerPayments, ({ one }) => ({
  farmer: one(farmers, { fields: [farmerPayments.farmerId], references: [farmers.id] }),
  procurement: one(procurements, { fields: [farmerPayments.procurementId], references: [procurements.id] }),
}));
export const pricingRulesRelations = relations(pricingRules, ({ one, many }) => ({
  collectionCenter: one(collectionCenters, {
    fields: [pricingRules.collectionCenterId],
    references: [collectionCenters.id],
  }),
  approvals: many(priceApprovals),
}));
export const priceApprovalsRelations = relations(priceApprovals, ({ one }) => ({
  pricingRule: one(pricingRules, { fields: [priceApprovals.pricingRuleId], references: [pricingRules.id] }),
}));

export const batchesRelations = relations(batches, ({ one, many }) => ({
  product: one(products, { fields: [batches.productId], references: [products.id] }),
  collectionCenter: one(collectionCenters, { fields: [batches.collectionCenterId], references: [collectionCenters.id] }),
  receiptLinks: many(batchReceipts),
  qualityTests: many(qualityTests),
  processingRuns: many(processingRuns),
  events: many(traceabilityEvents),
  movements: many(inventoryMovements),
}));
export const batchReceiptsRelations = relations(batchReceipts, ({ one }) => ({
  batch: one(batches, { fields: [batchReceipts.batchId], references: [batches.id] }),
  receipt: one(collectionReceipts, { fields: [batchReceipts.receiptId], references: [collectionReceipts.id] }),
}));
export const qualityTestsRelations = relations(qualityTests, ({ one }) => ({
  batch: one(batches, { fields: [qualityTests.batchId], references: [batches.id] }),
}));
export const processingRunsRelations = relations(processingRuns, ({ one }) => ({
  batch: one(batches, { fields: [processingRuns.batchId], references: [batches.id] }),
  location: one(inventoryLocations, { fields: [processingRuns.locationId], references: [inventoryLocations.id] }),
}));
export const inventoryMovementsRelations = relations(inventoryMovements, ({ one }) => ({
  batch: one(batches, { fields: [inventoryMovements.batchId], references: [batches.id] }),
  variant: one(productVariants, { fields: [inventoryMovements.variantId], references: [productVariants.id] }),
  from: one(inventoryLocations, { fields: [inventoryMovements.fromLocationId], references: [inventoryLocations.id], relationName: "from" }),
  to: one(inventoryLocations, { fields: [inventoryMovements.toLocationId], references: [inventoryLocations.id], relationName: "to" }),
}));
export const traceabilityEventsRelations = relations(traceabilityEvents, ({ one }) => ({
  batch: one(batches, { fields: [traceabilityEvents.batchId], references: [batches.id] }),
}));

export const ordersRelations = relations(orders, ({ many }) => ({ items: many(orderItems) }));
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  variant: one(productVariants, { fields: [orderItems.variantId], references: [productVariants.id] }),
}));
