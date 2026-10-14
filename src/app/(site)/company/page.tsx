import type { Metadata } from "next";
import Link from "next/link";
import { getContent } from "@/server/content/service";
import { Editable } from "@/components/edit/Editable";
import { MediaImage } from "@/components/product/MediaImage";
import { Prose } from "@/components/page/Prose";
import s from "@/components/page/page.module.css";

export const metadata: Metadata = {
  title: "Company",
  description: "HIMVEDA is a Nepal-focused agricultural procurement, marketplace and traceability business.",
  alternates: { canonical: "/company" },
};

export default async function CompanyPage() {
  const c = await getContent();
  return (
    <div className={`wrap ${s.page}`}>
      <header className={s.head}>
        <Editable k="company.kicker" as="p" className="margin-note" />
        <h1 className="display">
          <Editable k="company.title" />
        </h1>
        <Editable k="company.intro" as="p" className="lede" multiline />
      </header>

      <section className={s.ownerBlock} aria-labelledby="owner-title">
        {c["owner.image"] ? <MediaImage id={c["owner.image"]} alt={c["owner.name"]} className="" /> : null}
        <p className="small muted">Owner</p>
        <h2 id="owner-title" className={s.ownerName}>
          <Editable k="owner.name" />
        </h2>
        <Editable k="owner.title" as="p" className="lede" />
        {c["owner.bio"] ? <Prose source={c["owner.bio"]} className={`${s.prose} body-serif`} /> : null}
      </section>

      <div style={{ marginTop: 48, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/contact" className="btn">
          Contact HIMVEDA
        </Link>
        <Link href="/trace" className="btn btn-ghost">
          See how traceability works
        </Link>
      </div>
    </div>
  );
}
