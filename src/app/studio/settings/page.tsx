import { count, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { getContent } from "@/server/content/service";
import { DemoToggle, PurgeDemo } from "@/components/studio/forms";
import { DEV_RATE_SOURCE } from "@/server/currency/dev-rates";
import st from "@/components/studio/studio.module.css";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const c = await getContent();
  const [demoRows, rates] = await Promise.all([
    db.select({ n: count() }).from(schema.products).where(eq(schema.products.isDemo, true)),
    db.select({ source: schema.currencyRates.source }).from(schema.currencyRates).limit(1),
  ]);
  const demoProducts = demoRows[0]?.n ?? 0;
  const checks = [
    ["Database", Boolean(process.env.DATABASE_URL), "Connected"],
    ["Access-code pepper", Boolean(process.env.ADMIN_CODE_PEPPER && process.env.ADMIN_CODE_PEPPER.length >= 32), "Set"],
    ["Site URL", Boolean(process.env.NEXT_PUBLIC_SITE_URL), process.env.NEXT_PUBLIC_SITE_URL ?? "Not set"],
    ["Exchange rates", rates[0]?.source !== DEV_RATE_SOURCE, rates[0]?.source === DEV_RATE_SOURCE ? "Development rates (set FX_PROVIDER for live rates)" : `Live: ${rates[0]?.source}`],
    ["Rate refresh job", Boolean(process.env.CRON_SECRET), process.env.CRON_SECRET ? "Protected" : "CRON_SECRET not set"],
    ["Geolocation header", process.env.GEO_HEADER_SOURCE !== "none", process.env.GEO_HEADER_SOURCE ?? "vercel"],
  ] as const;
  return (
    <>
      <div className={st.pageHead}>
        <div>
          <h1>Settings</h1>
        </div>
      </div>
      <section className={st.panel}>
        <div className={st.panelHead}>
          <h2>Demonstration data</h2>
          <span className={st.status} data-tone={c["settings.demoMode"] ? "warn" : "ok"}>
            {c["settings.demoMode"] ? "Demonstration mode on" : "Live mode"}
          </span>
        </div>
        <p className="small" style={{ marginBottom: 14, maxWidth: "60em" }}>
          Sample producers, centres, batches, products and orders are labelled “Sample” everywhere and a notice appears at the top of the website.
          There are currently <strong>{demoProducts}</strong> sample products. When HIMVEDA’s real catalogue is ready, remove the sample data and turn
          demonstration mode off.
        </p>
        <DemoToggle on={c["settings.demoMode"]} />
        <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "20px 0" }} />
        <PurgeDemo />
      </section>
      <section className={st.panel}>
        <div className={st.panelHead}>
          <h2>Environment</h2>
        </div>
        <dl className={st.kv}>
          {checks.map(([k, ok, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>
                <span className={st.status} data-tone={ok ? "ok" : "warn"}>
                  {ok ? "OK" : "Check"}
                </span>{" "}
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
