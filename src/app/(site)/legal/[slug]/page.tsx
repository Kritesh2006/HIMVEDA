import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContent } from "@/server/content/service";
import { Prose } from "@/components/page/Prose";
import s from "@/components/page/page.module.css";

const PAGES = {
  privacy: { key: "legal.privacy", title: "Privacy" },
  terms: { key: "legal.terms", title: "Terms of sale" },
  shipping: { key: "legal.shipping", title: "Delivery & returns" },
} as const;

type Params = Promise<{ slug: string }>;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const p = PAGES[slug as keyof typeof PAGES];
  return p ? { title: p.title, alternates: { canonical: `/legal/${slug}` } } : {};
}

export default async function LegalPage({ params }: { params: Params }) {
  const { slug } = await params;
  const p = PAGES[slug as keyof typeof PAGES];
  if (!p) notFound();
  const c = await getContent();
  return (
    <div className={`wrap ${s.page}`}>
      <header className={s.head}>
        <h1 className="h1">{p.title}</h1>
      </header>
      <Prose source={c[p.key]} className={s.prose} />
    </div>
  );
}
