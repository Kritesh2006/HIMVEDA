import type { Metadata } from "next";
import Link from "next/link";
import { requireEditorPage } from "@/server/auth/session";
import { getOverview } from "@/server/ops/admin";
import { signOut } from "@/app/actions/access";
import { Mark } from "@/components/brand/Logo";
import { MobileNav, SideNav, TopTitle } from "@/components/studio/StudioNav";
import { ToastProvider } from "@/components/studio/ui";
import st from "@/components/studio/studio.module.css";

export const metadata: Metadata = { title: { default: "Studio", template: "%s · HIMVEDA Studio" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const session = await requireEditorPage();
  const o = await getOverview();
  const counts = {
    "/studio/collection": o.toInspect + o.toProcure,
    "/studio/orders": o.openOrders,
    "/studio/pricing": o.pendingApprovals,
  };
  return (
    <ToastProvider>
      <div className={st.shell}>
        <aside className={st.side}>
          <Link href="/studio" className={st.brand}>
            <Mark size={26} />
            <b>HIMVEDA</b>
            <span>Studio</span>
          </Link>
          <SideNav counts={counts} />
          <div className={st.sideFoot}>
            <Link href="/" target="_blank" rel="noopener">
              View website
            </Link>
            <form action={signOut}>
              <button type="submit">Sign out</button>
            </form>
          </div>
        </aside>
        <div style={{ minWidth: 0 }}>
          <header className={st.top}>
            <TopTitle />
            <div className={st.topRight}>
              <span className={st.who}>{session.displayName}</span>
              <Link href="/" className="btn btn-ghost btn-small">
                Site
              </Link>
              <form action={signOut}>
                <button type="submit" className="btn btn-ghost btn-small">
                  Sign out
                </button>
              </form>
            </div>
          </header>
          <MobileNav />
          <main className={st.main} id="main">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
