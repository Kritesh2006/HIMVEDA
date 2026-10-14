# Security

## Studio access

There is no public "Admin" button. The access screen lives at `/owner` and is `noindex`.

### Access codes

- Three authorised codes, one per editor slot ("Editor 1–3"), so every change is attributable.
- **Never** in source, `.env.example`, client bundles, HTML or API responses. `.env*` is git-ignored.
- Registered privately with `npm run admin:register`, which reads `ADMIN_CODE_1..3` from the environment (or prompts with hidden input) and stores only:

  ```
  hash = scrypt( HMAC-SHA256(ADMIN_CODE_PEPPER, code), per-credential salt, N=2^15 )
  ```

  The pepper exists only in the server environment, so a database dump alone can't be brute-forced offline. Rotating a code revokes that editor's sessions. The running application never reads `ADMIN_CODE_*`.

- 4-digit codes are inherently weak (10,000 combinations). The registration script accepts **4–12 digits**, and longer codes are strongly recommended.

### Verification

`attemptAccess()` (server action → `src/server/auth/access.ts`):

1. Checks throttling **before** any hash comparison.
2. Compares the submitted code against **all** active credentials with `timingSafeEqual`, with no early exit.
3. Records the attempt and pads every response to a uniform ~700 ms.
4. Returns only "not accepted", "locked (retry in N minutes)" or success. The UI never evaluates digits and only submits a complete code.

### Throttling (database-backed, so it holds across serverless instances)

| Scope | Rule |
| --- | --- |
| Per source (HMAC of client IP) | 5 failures / 15 min → locked 15 min |
| Per source | 12 failures / 24 h → locked 24 h |
| Global | 40 failures / 24 h → **all** sign-ins paused until the window clears; a `security.lockdown` audit entry is written |

The global cap bounds distributed guessing to about 40 attempts a day. Against 3 valid codes in 10,000, that puts the expected time to a hit well over two months, and the lockdown shows up on the Studio overview long before. `npm run admin:unlock` clears throttling after a lockdown.

> Client IP comes from `x-real-ip` / `x-forwarded-for`, which **Vercel sets and overwrites**. If you self-host, put the app behind a proxy that does the same, or per-source limits can be evaded. The global limit still applies either way.

### Sessions

- 32-byte random token. Only its SHA-256 is stored.
- Cookie `__Host-hv_session` in production: `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, no `Domain`.
- Expiry after 2 hours idle or 12 hours absolute. Server-side revocation on logout, code rotation, user deactivation, or from **Studio → Users**.

### Authorisation

- Middleware redirects `/studio/*` without a cookie, but that is only a convenience.
- Every Studio page calls `requireEditorPage()`, and **every** mutation goes through `run()` → `requireEditor()`, which validates the session against the database.
- Next.js Server Actions enforce same-origin (`Origin` vs `Host`), and the cookie is `SameSite=Strict`.
- Inline editing can only write keys declared in the content registry, validated by kind, with safe link schemes.

## Audit trail

`audit_logs` is append-only from the application's perspective. Studio offers no update or delete. Each entry records actor label, action, entity, a human summary, and before/after JSON, for example:

```
Editor 2 published changes to "Large Cardamom" — 100 g base price NPR 1,400 → NPR 1,550
Editor 1 approved Large cardamom (dried) · TPJ: NPR 1,450.00 → NPR 1,520.00/kg
```

Editor identities are never exposed publicly.

## Other measures

- Uploads are type-checked by magic bytes and capped at 4 MB. SVG is refused. Files are served with `X-Content-Type-Options: nosniff`.
- Owner-edited Markdown is rendered as React elements, so HTML is never injected. JSON-LD is serialised with `<` escaped.
- Security headers: `nosniff`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy`. `/owner` and `/studio` send `X-Robots-Tag: noindex`.
- Contact form: honeypot field and minimum fill time.
- `npm run check:secrets` scans git-tracked files and the built client bundle for configured secret values and common secret patterns.

## Verifying

```bash
SECRET_SCAN_VALUES="<code1>,<code2>,<code3>" npm run build && npm run check:secrets
E2E_ADMIN_CODE=•••• npm run test:e2e     # includes lockout, forged-cookie and bundle-secret tests
```
