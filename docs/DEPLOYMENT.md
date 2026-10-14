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

**Do not** add `ADMIN_CODE_1..3` to Vercel.

## 3. Register access codes (from your own machine, once)

```bash
DATABASE_URL="<production url>" ADMIN_CODE_PEPPER="<same pepper as Vercel>" npm run admin:register
# prompts for three codes with hidden input; only hashes are written
```

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
