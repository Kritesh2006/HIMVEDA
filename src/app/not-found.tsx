import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <main className="wrap" style={{ minHeight: "100svh", display: "grid", alignContent: "center", gap: 24, paddingBlock: 48 }}>
      <Link href="/" aria-label="HIMVEDA home" style={{ textDecoration: "none" }}>
        <Logo />
      </Link>
      <svg viewBox="0 0 240 60" width="240" aria-hidden="true">
        <path d="M6 50 C 50 48, 70 12, 120 12" fill="none" stroke="var(--marigold)" strokeWidth="2.5" />
        <path d="M120 12 C 170 12, 190 46, 234 42" fill="none" stroke="var(--ink-3)" strokeWidth="1.5" strokeDasharray="3 6" />
        <circle cx="120" cy="12" r="6" fill="var(--marigold)" />
      </svg>
      <h1 className="h1" style={{ maxWidth: "14em" }}>
        This path ends here.
      </h1>
      <p className="lede">The page you were looking for doesn’t exist or has moved.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/" className="btn">
          Go to the homepage
        </Link>
        <Link href="/market" className="btn btn-ghost">
          Browse the market
        </Link>
      </div>
    </main>
  );
}
