import { refreshRates } from "@/server/currency/service";
import { writeAudit } from "@/server/audit";

/** Vercel Cron (see vercel.json) — refreshes exchange rates. Protected by CRON_SECRET. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const res = await refreshRates();
  await writeAudit(null, { action: "fx.refresh", entityType: "currency", summary: `Exchange rates refreshed from ${res.source} (${res.count} currencies)${res.error ? `; provider error: ${res.error}` : ""}` });
  return Response.json(res);
}
