import Link from "next/link";
import { Mark } from "@/components/brand/Logo";
import type { ContentMap } from "@/server/content/registry";
import styles from "./Footer.module.css";

export function Footer({ c }: { c: ContentMap }) {
  const year = new Date().getFullYear();
  const contact = [
    c["contact.email"] && { label: c["contact.email"], href: `mailto:${c["contact.email"]}` },
    c["contact.phone"] && { label: c["contact.phone"], href: `tel:${c["contact.phone"].replace(/[^\d+]/g, "")}` },
  ].filter(Boolean) as { label: string; href: string }[];
  return (
    <footer className={`on-forest ${styles.footer}`}>
      <div className={`wrap ${styles.grid}`}>
        <div className={styles.brand}>
          <Mark size={40} />
          <p className={styles.statement}>{c["footer.statement"]}</p>
        </div>
        <nav aria-label="Footer" className={styles.cols}>
          <div>
            <h2 className={styles.colTitle}>Market</h2>
            <ul role="list">
              <li><Link href="/market">All products</Link></li>
              <li><Link href="/trace">Trace a batch</Link></li>
              <li><Link href="/checkout">Order request</Link></li>
            </ul>
          </div>
          <div>
            <h2 className={styles.colTitle}>HIMVEDA</h2>
            <ul role="list">
              <li><Link href="/producers">For producers</Link></li>
              <li><Link href="/company">Company</Link></li>
              <li><Link href="/contact">Contact</Link></li>
              <li><Link href="/faq">Questions</Link></li>
            </ul>
          </div>
          <div>
            <h2 className={styles.colTitle}>Policies</h2>
            <ul role="list">
              <li><Link href="/legal/privacy">Privacy</Link></li>
              <li><Link href="/legal/terms">Terms of sale</Link></li>
              <li><Link href="/legal/shipping">Delivery & returns</Link></li>
            </ul>
          </div>
          {contact.length || c["social.links"].length ? (
            <div>
              <h2 className={styles.colTitle}>Contact</h2>
              <ul role="list">
                {contact.map((x) => (
                  <li key={x.href}><a href={x.href}>{x.label}</a></li>
                ))}
                {c["social.links"].map((s) => (
                  <li key={s.href}><a href={s.href} rel="noopener noreferrer" target="_blank">{s.network}</a></li>
                ))}
              </ul>
            </div>
          ) : null}
        </nav>
      </div>
      <div className={`wrap ${styles.base}`}>
        <span>© {year} HIMVEDA</span>
        <span>Nepal</span>
      </div>
    </footer>
  );
}
