# HIMVEDA

**Traceable produce from Nepal.** HIMVEDA connects producers, physical collection centres and buyers through one relational record: every delivery is weighed and receipted, inspected before it is bought, processed in a numbered batch, and sold with its journey attached at `/trace/<batch-code>`.

This repository is HIMVEDA V2: the public website and marketplace at **himvedanepal.com**, and **HIMVEDA Studio**, the owner's operating platform. Studio covers products, pricing, procurement, inventory, traceability, orders and website content, all without touching code.

> **Demonstration data.** The seed loads a connected, fictional scenario (sample producers, centres, batches, products and orders) so the system can be judged end to end. Every sample record is flagged `is_demo`, labelled "Sample" on screen, and removable in one action from **Studio → Settings**. None of it describes real HIMVEDA partners, products or prices.

---

## What's inside

| Area | What it does |
| --- | --- |
| **Public site** | Editorial homepage with a live, data-driven supply-chain story; marketplace with search, filters, sorting and cart; product pages; order requests; producer, company, contact, FAQ and policy pages. |
| **Traceability** | `/trace/HIM-26-KTM-00482`. Origin (aggregated to ~10 km), collection, inspection, processing yields and availability, drawn on a real map of Nepal. Private data never leaves the database. |
| **Country & currency** | One canonical NPR price. Visitors see their local currency from edge geolocation, then a time-zone estimate, then NPR. Includes a manual selector, saved choices, owner-set regional prices that override conversion, and a pluggable FX provider. |
| **HIMVEDA Studio** | `/owner`, then `/studio`. Products (draft → preview → publish), inventory, pricing (FX, rounding, two-person procurement-rate approval), orders, farmers, collection receipts, inspections, payments, batches and trace events, website content, media, users and sessions, settings, and a full audit log. |
| **Inline editing** | Signed-in editors can switch on **Edit website** and change headings, copy and buttons directly on the page. Changes go through Save, Cancel and Preview, then a validated, audited server action. |

## Stack

- **Next.js 15** (App Router, React Server Components, Server Actions) + **TypeScript** (strict)
- **PostgreSQL** + **Drizzle ORM** with SQL migrations ([why not Prisma](docs/ARCHITECTURE.md#why-drizzle))
- Plain CSS Modules on a token system. No UI kit, no animation library, and about 111 kB first-load JS on the homepage.
- Vitest (unit) + Playwright (end-to-end)

A modular monolith: one deployable, with domain modules under `src/server/*`.

## Quick start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env            # fill DATABASE_URL, ADMIN_CODE_PEPPER, CRON_SECRET

# 3. Database
npm run db:migrate
npm run db:seed                 # connected demonstration scenario

# 4. Register the Studio access codes (privately; codes are hashed, never stored)
ADMIN_CODE_1=•••• ADMIN_CODE_2=•••• ADMIN_CODE_3=•••• npm run admin:register
#   or run `npm run admin:register` with no variables to be prompted

# 5. Run
npm run dev                     # http://localhost:3000   ·   Studio: /owner
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | ESLint, `tsc --noEmit` |
| `npm test` | Unit tests (pricing, currency, auth hashing, throttling, catalog validation, content validation) |
| `npm run test:e2e` | Playwright suite against a running, seeded server (`E2E_ADMIN_CODE=•••• npm run test:e2e` to include Studio tests) |
| `npm run db:generate` | Generate a migration from `src/server/db/schema.ts` |
| `npm run db:migrate` / `db:seed` / `db:reset` | Apply migrations, load demo data, or reset (refuses production URLs) |
| `npm run admin:register` | Register or rotate the three access codes (salted, peppered scrypt hashes) |
| `npm run admin:unlock` | Clear access throttling after a lockdown |
| `npm run fx:refresh` | Refresh exchange rates from the configured provider |
| `npm run geo:build` | Rebuild the Nepal outline and terrain contours (`src/generated/nepal-geo.json`) |
| `npm run check:secrets` | Scan tracked files and the client bundle for secrets |

## Documentation

- [Architecture](docs/ARCHITECTURE.md): modules, request flow, currency, CMS, media, decisions
- [Database](docs/DATABASE.md): schema, relations, conventions
- [Design system](docs/DESIGN_SYSTEM.md): palette, type, motion, illustration, the "no AI look" rules
- [Traceability](docs/TRACEABILITY.md): batch codes, the chain, what is public and private
- [Security](docs/SECURITY.md): access codes, throttling, sessions, authorisation, audit
- [Deployment](docs/DEPLOYMENT.md): Vercel + managed Postgres, environment, cron, going live
- [Old site audit](docs/OLD_SITE_AUDIT.md): what was not migrated from the previous website, and why

## Content principles

The previous website contained fabricated testimonials, a fictional team and founder story, invented statistics, and certification and lab claims with no evidence behind them. None of it was migrated. In V2:

- No reviews, ratings, testimonials or customer counts exist until real ones do. There is no `Review` or `AggregateRating` schema.
- Laboratory results appear only with the performing lab named and, where public, the report attached. Certifications appear only once on file.
- Unknown business facts (contact details, history, policies) default to empty and their sections simply don't render, or say plainly that they are being finalised.
- The owner, **Madhav Dhungel**, is shown by name and title only, until he supplies or approves anything more.
