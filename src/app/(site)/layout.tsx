import Link from "next/link";
import { getContent } from "@/server/content/service";
import { getCurrencyContext, isDevRates } from "@/server/currency/service";
import { getEditorSession, isEditMode } from "@/server/auth/session";
import { HeaderClient } from "@/components/site/HeaderClient";
import { Footer } from "@/components/site/Footer";
import { CurrencyBootstrap } from "@/components/currency/CurrencyBootstrap";
import { InViewObserver, PointerEffects } from "@/components/motion/InViewObserver";
import { EditorBar } from "@/components/edit/EditorBar";
import styles from "./site.module.css";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [c, ctx, session, editing] = await Promise.all([getContent(), getCurrencyContext(), getEditorSession(), isEditMode()]);
  const ann = c["announcement.enabled"] && c["announcement.text"];
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {c["settings.demoMode"] ? (
        <div className={styles.demo} role="note">
          <div className="wrap">
            <strong>Demonstration build.</strong>{" "}
            <span className={styles.demoLong}>Products, producers, batches and prices shown are sample data, not HIMVEDA’s live catalogue.</span>
            <span className={styles.demoShort}>Everything shown is sample data.</span>
          </div>
        </div>
      ) : null}
      {ann ? (
        <div className={styles.announcement}>
          <div className="wrap">
            {c["announcement.text"]}
            {c["announcement.link"].href ? (
              <>
                {" "}
                <Link href={c["announcement.link"].href}>{c["announcement.link"].label || "Learn more"}</Link>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      <HeaderClient
        nav={c["nav.items"]}
        currency={{ currency: ctx.currency, source: ctx.source, country: ctx.country, devRates: isDevRates(ctx) }}
      />
      <main id="main" tabIndex={-1} className={styles.main}>
        {children}
      </main>
      <Footer c={c} />
      <CurrencyBootstrap source={ctx.source} hasGeo={Boolean(ctx.country)} />
      <InViewObserver />
      <PointerEffects />
      {session ? <EditorBar label={session.label} editing={editing} /> : null}
    </>
  );
}
