import { sql } from "drizzle-orm";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** Liveness + configuration check. Exposes no IPs, secrets or personal data. */
export async function GET(req: Request) {
  let database = false;
  try {
    await db.execute(sql`select 1`);
    database = true;
  } catch {
    database = false;
  }
  const h = req.headers;
  const geo = h.get("x-vercel-ip-country") ? "x-vercel-ip-country" : h.get("cf-ipcountry") ? "cf-ipcountry" : null;
  return Response.json(
    {
      ok: database,
      database,
      geoHeader: geo,
      geoCountry: geo ? h.get(geo) : null,
      geoSourceConfigured: process.env.GEO_HEADER_SOURCE ?? "vercel",
      ipHeaderConfigured: process.env.TRUSTED_IP_HEADER ?? "default",
      ipHeadersPresent: ["cf-connecting-ip", "x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"].filter((n) => h.has(n)),
    },
    { status: database ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
