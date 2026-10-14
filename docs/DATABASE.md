# Database

PostgreSQL, defined in `src/server/db/schema.ts` (Drizzle) with SQL migrations in `drizzle/`.

```bash
npm run db:generate   # after editing schema.ts → new drizzle/NNNN_*.sql
npm run db:migrate    # apply
npm run db:seed       # demonstration scenario (idempotent; --force replaces demo data)
npm run db:reset      # development only — refuses production URLs
```

## Conventions

- **Money**: integer minor units with an explicit currency (`base_price_minor` is NPR paisa). NPR is canonical.
- **Weight**: integer grams.
- **Demo data**: `is_demo boolean` on every table that can hold sample records, plus `purgeDemoData()`.
- **Public vs private**: explicit flags (`is_public`, `publish_consent`, `public_name`), defaulting to private.
- **Timestamps**: `timestamptz`, `created_at` / `updated_at`.
- **IDs**: UUID v4. Human codes (`FMR-0001`, `RC-TPJ-1003`, `HIM-26-TPJ-00217`, `HV-2610-1042`) are separate unique columns.

## Entity map

```
users ─┬─< admin_credentials          one per access code (slot 1..3), scrypt hash + salt
       ├─< admin_sessions             hashed token, idle/absolute expiry, revocation
       └─< audit_logs (actor)         append-only: action, entity, summary, before/after JSON
access_attempts                       throttling ledger (HMAC of IP, success flag)

categories ─< products ─┬─< product_variants ─< regional_prices
                        ├─< product_media >─ media
                        ├── farmers (producer, optional)
                        ├── collection_centers (optional)
                        └── batches (primary batch, optional)

farmers ─┬─< farms
         ├─< collection_receipts >─ collection_centers
         │        ├─< inspections
         │        └── procurements ─< farmer_payments
         └─< farmer_payments

pricing_rules (display_rounding | procurement_rate) ─< price_approvals
currency_rates                        latest units-per-NPR per currency

batches ─┬─< batch_receipts >─ collection_receipts
         ├─< processing_runs >─ inventory_locations
         ├─< quality_tests ── media (report, optional)
         ├─< traceability_events
         └─< inventory_movements >─ inventory_locations / product_variants

orders ─< order_items >─ product_variants   (NPR amounts + display snapshot + batch code)
contact_messages
site_content                          CMS key/value (validated against the registry)
```

## The chain in tables

| Step | Table(s) | Key fields |
| --- | --- | --- |
| Producer registered | `farmers`, `farms` | district, approximate lat/lng (2 dp), consent to publish a name |
| Delivery weighed | `collection_receipts` | gross/tare/net grams, centre, harvest date |
| Inspected | `inspections` | grade, moisture, foreign matter, accepted grams, pass/hold/fail |
| Bought | `procurements` | accepted grams × approved rate (from `pricing_rules`) |
| Paid | `farmer_payments` | amount, method, reference, status |
| Batched | `batches`, `batch_receipts` | permanent code, input/output grams, packs |
| Processed | `processing_runs` | input/output grams per run |
| Checked | `quality_tests` | value, limit, pass, performed by, optional report |
| Published | `traceability_events` | public title/description/metrics, private notes |
| Stocked & sold | `inventory_movements`, `product_variants`, `order_items` | every stock change has a reason; order lines keep the batch code |

## Integrity

- Uniques: slugs, SKUs, batch codes, receipt numbers, order numbers, centre codes, `(variant, currency)` regional prices.
- `ON DELETE RESTRICT` protects the ledger. A producer with receipts, or a receipt in a batch, cannot be deleted.
- Order creation decrements stock with a guarded `UPDATE … WHERE stock >= qty` inside the order transaction, so stock can't go negative under concurrency.
