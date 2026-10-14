import type { Metadata } from "next";
import { getContent } from "@/server/content/service";
import { Editable } from "@/components/edit/Editable";
import { ContactForm } from "@/components/page/ContactForm";
import s from "@/components/page/page.module.css";

export const metadata: Metadata = { title: "Contact", alternates: { canonical: "/contact" } };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ContactPage({ searchParams }: { searchParams: SP }) {
  const [c, sp] = await Promise.all([getContent(), searchParams]);
  const rows = [
    ["Email", c["contact.email"], c["contact.email"] ? `mailto:${c["contact.email"]}` : null],
    ["Phone", c["contact.phone"], c["contact.phone"] ? `tel:${c["contact.phone"].replace(/[^\d+]/g, "")}` : null],
    ["WhatsApp", c["contact.whatsapp"], c["contact.whatsapp"] ? `https://wa.me/${c["contact.whatsapp"].replace(/\D/g, "")}` : null],
    ["Address", c["contact.address"], null],
    ["Hours", c["contact.hours"], null],
  ].filter(([, v]) => v) as [string, string, string | null][];
  return (
    <div className={`wrap ${s.page}`}>
      <div className={s.twoCol}>
        <header className={s.head} style={{ marginBottom: 0 }}>
          <h1 className="display">
            <Editable k="contact.title" />
          </h1>
          <Editable k="contact.body" as="p" className="lede" multiline />
          {rows.length ? (
            <dl className={s.contactList}>
              {rows.map(([k, v, href]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{href ? <a href={href}>{v}</a> : v}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {c["social.links"].length ? (
            <p className="small">
              {c["social.links"].map((l, i) => (
                <span key={l.href}>
                  {i ? " · " : ""}
                  <a href={l.href} rel="noopener noreferrer" target="_blank">
                    {l.network}
                  </a>
                </span>
              ))}
            </p>
          ) : null}
        </header>
        <ContactForm topic={typeof sp.topic === "string" ? sp.topic : undefined} />
      </div>
    </div>
  );
}
