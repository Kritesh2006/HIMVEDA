"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="wrap" style={{ paddingBlock: "clamp(64px, 10vw, 140px)", display: "grid", gap: 20, maxWidth: 760 }}>
      <h1 className="h1">Something went wrong loading this page.</h1>
      <p className="lede">The record is safe — this was a problem displaying it. Try again, or come back in a moment.</p>
      {error.digest ? <p className="small muted">Reference: {error.digest}</p> : null}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="btn" onClick={reset}>
          Try again
        </button>
        <Link href="/" className="btn btn-ghost">
          Go to the homepage
        </Link>
      </div>
    </div>
  );
}
