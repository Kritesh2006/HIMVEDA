# Architecture

HIMVEDA V2 is a **modular monolith**: a single Next.js application whose server code is split into domain modules. There are no microservices. The domain is one connected ledger, from receipt to batch to order, and splitting it would only add distributed-consistency problems.

```
src/
├─ app/                       Routes (App Router)
│  ├─ (site)/                 Public site: home, market, products, trace, pages, checkout
│  ├─ owner/                  Access screen
│  ├─ studio/                 HIMVEDA Studio (+ actions.ts: every Studio mutation)
│  ├─ actions/                Public server actions (currency, cart, contact, orders, inline edit)
│  └─ api/                    media/[id], cron/fx
├─ components/                UI (CSS Modules), grouped by surface
├─ lib/                       Pure, isomorphic helpers (currency config & formatting, geo, slug)
├─ generated/                 nepal-geo.json (built by scripts/build-geo.ts)
└─ server/                    Server-only domain modules
   ├─ db/                     Drizzle schema + pooled client
   ├─ auth/                   Code hashing, throttling, sessions, access
   ├─ currency/               Pricing (pure), FX providers, request currency context
   ├─ catalog/                Product input contract, queries, mutations, audit diffs
   ├─ content/                CMS registry, validation, service
   ├─ trace/                  Public trace view model
   ├─ orders/                 Order requests
   ├─ ops/                    Studio operations: producers, collection, procurement, batches, pricing, users, media
   ├─ home/                   Homepage data
   ├─ demo/                   Demo-data purge
   └─ audit.ts                Append-only audit writer
```

Modules marked `server-only` cannot be imported by client components. The build fails if they are. Pure modules (`server/currency/pricing.ts`, `server/catalog/{input,diff}.ts`, `server/content/validate.ts`) are shared by server code and unit tests.

## Request flow

1. **Middleware** (`src/middleware.ts`) reads the platform's geolocation header (configurable) and stores `hv_geo=<CC>:edge`. It also gates `/studio/*` on the presence of a session cookie. This is only a cheap redirect; real authorisation happens later.
2. **Server components** render pages from the database. Each request resolves its currency context once (`getCurrencyContext`, memoised with `React.cache`), and every price on the page is computed server-side from that context.
3. **Client components** are small islands: cart, currency selector, filters, the scroll story, the editor bar and Studio forms.
4. **Mutations** are Server Actions. Every Studio action goes through `run()` in `app/studio/actions.ts`, which re-checks the session, validates input with Zod, performs the change in a transaction with its audit record, and revalidates affected paths.

## One price, everywhere

`product_variants.base_price_minor` (NPR paisa) is the only stored retail price. Homepage cards, market results, search, product pages, cart, checkout and recommendations all read it through `priceFor()`. The cart stores only `{variantId, quantity}` in the browser and is re-priced on the server on every view. A price change in Studio therefore appears everywhere on the next request. `revalidatePath("/", "layout")` is called on publish.

## Country & currency

```
lib/currency/config.ts        currencies, country→currency map, Intl formatting   (no rates)
server/currency/dev-rates.ts  documented development reference rates
server/currency/provider.ts   FxProvider interface: DevStaticProvider, ExchangeRateApiProvider
server/currency/pricing.ts    resolvePrice(): override → conversion → NPR (pure, tested)
server/currency/service.ts    loadRates(), refreshRates(), getCurrencyContext()
```

Detection order: **manual choice** (`hv_currency` cookie, mirrored to localStorage) → **edge geolocation** (`x-vercel-ip-country` / `cf-ipcountry`) → **time-zone estimate** (client, only when no other signal exists, never browser language) → **NPR**. A detected but unmapped country shows USD.

Rates live only in the `currency_rates` table. Components receive already-resolved `Money` values; `<Price>` only formats and animates them. Converted amounts carry `approximate: true` and render with "≈". Regional prices (`regional_prices`) are owner-set amounts that take precedence over conversion for one currency. Orders are recorded in NPR with the display currency and FX rate stored as a snapshot.

To use live rates, set `FX_PROVIDER=exchangerate-api` and `FX_API_KEY`. Vercel Cron calls `/api/cron/fx` every six hours (`vercel.json`). Without a provider, the documented development rates are used and Studio says so.

## Content management

`server/content/registry.ts` declares every editable key with its kind, label, group, length limit and default. A key must exist there before it can be stored, which is what makes inline editing safe: the browser can only change declared keys, and each value is validated by kind (`validate.ts`). Links must be relative, `http(s)`, `mailto:` or `tel:`. Defaults contain no invented facts.

`<Editable k="…">` renders plain markup for visitors. For a signed-in editor in edit mode it adds `data-edit-*` attributes, which `EditorBar` turns into `contenteditable` regions with Save, Cancel and Preview.

## Media

Uploads are validated by magic bytes (JPEG, PNG, WebP, AVIF, PDF; SVG is rejected), capped at 4 MB, and stored in Postgres (`media.data`). They are served by `/api/media/[id]` with immutable caching. This needs no extra service or credential. The `media.external_url` column is the upgrade path to object storage or a CDN when volume grows.

## Illustration and geography

Products without photographs use **specimen plates**: botanical line drawings generated in SVG per commodity type. They are honest placeholders, not stock photos posing as products. The map of Nepal is built from Natural Earth 1:10m geometry, with illustrative terrain contours generated from a physiographic profile. River valleys follow the Karnali, Kali Gandaki, Trishuli and Arun. See `scripts/build-geo.ts`.

## Why Drizzle

The brief preferred Prisma "unless a technically stronger option is justified". Drizzle was chosen because:

- **No native engine.** Prisma's query and schema engines are platform binaries downloaded at install. Drizzle is plain TypeScript over `node-postgres`, so cold starts on serverless are smaller, and builds work in restricted CI and sandboxed environments where the engine download is blocked. That was the case where this project was built.
- **SQL-first migrations.** `drizzle/*.sql` are reviewable SQL files applied by a tiny migrator (`scripts/migrate.ts`).
- **Typed relational queries** with the same ergonomics for this schema's needs.

## Decisions worth knowing

- **Order requests, not payments.** No payment gateway is wired in: no verified payment provider exists for the business yet, and charging foreign cards in NPR has conversion and chargeback implications. Orders reserve stock and HIMVEDA confirms price, delivery and payment directly. The `orders` model already stores NPR amounts plus display-currency snapshots for a future gateway.
- **Draft workflow.** Edits to a published product are stored as a validated JSON draft (`products.draft`). The live record is untouched until Publish, which applies the draft in one transaction. Preview renders the draft for editors only.
- **Two-person procurement pricing.** Changes to rates paid to producers create a `price_approvals` row that a different editor must approve.
