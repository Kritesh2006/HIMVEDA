"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { CartButton } from "@/components/cart/CartDrawer";
import { CurrencySelector } from "@/components/currency/CurrencySelector";
import styles from "./Header.module.css";

interface NavItem {
  label: string;
  href: string;
}

export function HeaderClient({ nav, currency }: { nav: NavItem[]; currency: React.ComponentProps<typeof CurrencySelector> }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const menu = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    menu.current?.close();
  }, [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href.split("#")[0] || "/__"));

  return (
    <header className={styles.header} data-scrolled={scrolled || undefined} data-home={pathname === "/" || undefined}>
      <div className={`wrap ${styles.bar}`}>
        <Link href="/" className={styles.home} aria-label="HIMVEDA home">
          <Logo compact={scrolled} />
        </Link>
        <nav aria-label="Main" className={styles.nav}>
          <ul role="list">
            {nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} aria-current={isActive(n.href) ? "page" : undefined} className={styles.navLink}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.tools}>
          <div className={styles.currencyDesktop}>
            <CurrencySelector {...currency} />
          </div>
          <CartButton />
          <button type="button" className={styles.menuBtn} onClick={() => menu.current?.showModal()} aria-haspopup="dialog">
            <span className={styles.burger} aria-hidden="true" />
            <span>Menu</span>
          </button>
        </div>
      </div>

      <dialog ref={menu} className={styles.sheet} aria-label="Menu" onClick={(e) => e.target === menu.current && menu.current?.close()}>
        <div className={styles.sheetInner}>
          <div className={styles.sheetTop}>
            <Logo />
            <button type="button" className={styles.close} onClick={() => menu.current?.close()}>
              Close
            </button>
          </div>
          <nav aria-label="Mobile">
            <ul role="list" className={styles.sheetNav}>
              <li>
                <Link href="/">Home</Link>
              </li>
              {nav.map((n, i) => (
                <li key={n.href} style={{ ["--d" as string]: `${60 + i * 40}ms` }}>
                  <Link href={n.href} aria-current={isActive(n.href) ? "page" : undefined}>
                    {n.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/contact">Contact</Link>
              </li>
            </ul>
          </nav>
          <div className={styles.sheetFoot}>
            <span className="small muted">Currency</span>
            <CurrencySelector {...currency} placement="up" />
          </div>
        </div>
      </dialog>
    </header>
  );
}
