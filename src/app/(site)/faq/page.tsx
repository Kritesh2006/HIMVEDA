import type { Metadata } from "next";
import { getContent } from "@/server/content/service";
import s from "@/components/page/page.module.css";

export const metadata: Metadata = { title: "Questions", alternates: { canonical: "/faq" } };

export default async function FaqPage() {
  const c = await getContent();
  const items = c["faq.items"];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
  };
  return (
    <div className={`wrap ${s.page}`}>
      <header className={s.head}>
        <h1 className="display">Questions</h1>
      </header>
      <div className={s.faq}>
        {items.map((i) => (
          <details key={i.q}>
            <summary>{i.q}</summary>
            <p>{i.a}</p>
          </details>
        ))}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </div>
  );
}
