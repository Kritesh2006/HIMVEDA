"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import st from "./studio.module.css";

export const SECTIONS = [
  { group: "", items: [{ href: "/studio", label: "Overview" }] },
  {
    group: "Catalogue",
    items: [
      { href: "/studio/products", label: "Products" },
      { href: "/studio/inventory", label: "Inventory" },
      { href: "/studio/pricing", label: "Pricing" },
    ],
  },
  { group: "Commerce", items: [{ href: "/studio/orders", label: "Orders" }] },
  {
    group: "Supply chain",
    items: [
      { href: "/studio/farmers", label: "Farmers" },
      { href: "/studio/collection", label: "Collection" },
      { href: "/studio/quality", label: "Quality" },
      { href: "/studio/traceability", label: "Traceability" },
    ],
  },
  {
    group: "Website",
    items: [
      { href: "/studio/website", label: "Website" },
      { href: "/studio/media", label: "Media" },
    ],
  },
  {
    group: "Administration",
    items: [
      { href: "/studio/users", label: "Users" },
      { href: "/studio/settings", label: "Settings" },
      { href: "/studio/audit", label: "Audit log" },
    ],
  },
];

const isActive = (path: string, href: string) => (href === "/studio" ? path === "/studio" : path.startsWith(href));

export function SideNav({ counts }: { counts: Record<string, number> }) {
  const path = usePathname();
  return (
    <nav aria-label="Studio" style={{ display: "grid", gap: 18 }}>
      {SECTIONS.map((g) => (
        <div key={g.group} className={st.navGroup}>
          {g.group ? <span className={st.navTitle}>{g.group}</span> : null}
          {g.items.map((i) => (
            <Link key={i.href} href={i.href} className={st.navLink} aria-current={isActive(path, i.href) ? "page" : undefined}>
              {i.label}
              {counts[i.href] ? <span className={st.navCount}>{counts[i.href]}</span> : null}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

export function MobileNav() {
  const path = usePathname();
  return (
    <nav aria-label="Studio sections" className={st.mobileNav}>
      {SECTIONS.flatMap((g) => g.items).map((i) => (
        <Link key={i.href} href={i.href} aria-current={isActive(path, i.href) ? "page" : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export function TopTitle() {
  const path = usePathname();
  const all = SECTIONS.flatMap((g) => g.items);
  const cur = [...all].sort((a, b) => b.href.length - a.href.length).find((i) => isActive(path, i.href));
  return <span className={st.topTitle}>{cur?.label ?? "Studio"}</span>;
}
