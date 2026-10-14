# Deployment

**Recommended:** Vercel (application) + a managed PostgreSQL such as Neon or Supabase (data). GitHub is the source of truth. GitHub Pages can't host this, because the app needs a server and a database.

## 1. Database

Create a Postgres 15+ database and copy its connection string (with `sslmode=require`).

```bash
DATABASE_URL="postgresql://…" npm run db:migrate
```

For a **demonstration** deployment, also run `npm run db:seed`. For the **live** site, skip the seed, or seed and then remove sample data from Studio → Settings.

## 2. Secrets (set privately in Vercel → Project → Settings → Environment Variables)

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Production connection string |
| `NEXT_PUBLIC_SITE_URL` | `https://himvedanepal.com` (canonical URLs, sitemap, Open Graph) |
| `ADMIN_CODE_PEPPER` | `openssl rand -hex 32`. Changing it invalidates all codes |
| `CRON_SECRET` | `openssl rand -hex 24`. Vercel Cron sends it automatically |
| `FX_PROVIDER`, `FX_API_KEY` | Optional live rates (`exchangerate-api`) |
| `GEO_HEADER_SOURCE` | `vercel` (default), `cloudflare`, or `none` |
| `TRUSTED_IP_HEADER` | Header your edge overwrites with the client IP: `x-real-ip` (Vercel), `cf-connecting-ip` (Render, Cloudflare) |
| `ADMIN_CREDENTIAL_HASHES` | Output of `npm run admin:hash` (hashes only) |

**Do not** add `ADMIN_CODE_1..3` to Vercel.

## 3. Access codes, without the codes ever reaching the host

```bash
# privately, with the SAME pepper you set on the host:
ADMIN_CODE_PEPPER=… ADMIN_CODE_1=•••• ADMIN_CODE_2=•••• ADMIN_CODE_3=•••• npm run admin:hash
```

Set the printed value as `ADMIN_CREDENTIAL_HASHES` on the host. On every deploy, `npm run deploy:prepare` runs migrations, seeds demonstration data only into an empty database, and syncs the hashes (`npm run admin:sync`). Unchanged hashes are left alone, so sessions survive redeploys.

Alternatively, with direct database access: `DATABASE_URL=… ADMIN_CODE_PEPPER=… npm run admin:register`.

## 4. Deploy

Import the GitHub repository into Vercel. The framework preset is Next.js and no build settings need changing. `vercel.json` registers the exchange-rate refresh cron (every 6 hours).

## 5. Domain

Add `himvedanepal.com` (and `www`) in Vercel → Domains, and point DNS as instructed. The old site's canonical tags pointed at `himveda.theripplebytes.com`. V2 always emits `NEXT_PUBLIC_SITE_URL`.

> **Before switching DNS away from the current site**, make sure the business owner has approved it. Switching DNS takes the previous website offline.

## 6. Go-live checklist

- [ ] Real products entered in Studio, with prices in NPR approved by the owner
- [ ] Sample data removed and demonstration mode off (Studio → Settings)
- [ ] Contact details, social links and owner details filled in (Studio → Website)
- [ ] Terms, delivery and privacy policy text finalised (Studio → Website → Legal)
- [ ] Live FX provider configured, or development-rate notice accepted
- [ ] `npm run check:secrets` passes on the deployed commit
- [ ] Studio access tested from each editor's device; logout tested

## Self-hosting

`npm run build && npm start` behind a reverse proxy that sets `X-Real-IP` and terminates TLS. Set `GEO_HEADER_SOURCE=cloudflare` if you're behind Cloudflare, or `none` otherwise. Call `/api/cron/fx` from cron with `Authorization: Bearer $CRON_SECRET`.

## Render + Neon (alternative used for the V2 preview)

- **Web service**: build `npm ci --include=dev && npm run deploy:prepare && npm run build`, start `npm start`, health check `/api/health`.
- **Database**: Neon Postgres (`sslmode=require`).
- Render serves through Cloudflare. `GET /api/health` reports whether a country header is present. Use `GEO_HEADER_SOURCE=cloudflare` if it is, and `none` otherwise (the time-zone fallback then applies).
- Free web services sleep when idle, so the first request after a pause takes a little while.

## Checking a live deployment

Actions → **Live deployment check** → *Run workflow* with the URL. It runs the browser suite in live-safe mode: no orders, no contact messages, no lockouts, no rate changes, and its test product is deleted afterwards. Add an `E2E_ADMIN_CODE` repository secret to include the Studio tests.
