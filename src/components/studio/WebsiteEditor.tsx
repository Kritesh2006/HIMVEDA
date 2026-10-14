"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveContentAction } from "@/app/studio/actions";
import { useToast } from "./ui";
import st from "./studio.module.css";

export interface Entry {
  key: string;
  kind: "text" | "richtext" | "image" | "link" | "json" | "boolean";
  label: string;
  group: string;
  help?: string;
  max?: number;
  value: unknown;
}

type Row = Record<string, string>;

const LIST_SHAPES: Record<string, { fields: [string, string, "text" | "area"][]; fixed?: boolean; blank: Row }> = {
  "nav.items": { fields: [["label", "Label", "text"], ["href", "Link", "text"]], blank: { label: "", href: "/" } },
  "social.links": { fields: [["network", "Network", "text"], ["href", "Link", "text"]], blank: { network: "", href: "https://" } },
  "faq.items": { fields: [["q", "Question", "text"], ["a", "Answer", "area"]], blank: { q: "", a: "" } },
  "home.audiences.items": {
    fields: [["who", "Audience", "text"], ["line", "Line", "text"], ["ctaLabel", "Button text", "text"], ["ctaHref", "Button link", "text"]],
    blank: { who: "", line: "", ctaLabel: "", ctaHref: "/" },
  },
  "home.chain.steps": {
    fixed: true,
    fields: [["name", "Name", "text"], ["nameNe", "Name in Nepali", "text"], ["title", "Title", "text"], ["body", "Text", "area"], ["recorded", "Recorded fields (comma separated)", "text"]],
    blank: {},
  },
};

const toRows = (key: string, v: unknown): Row[] => {
  const arr = Array.isArray(v) ? v : [];
  if (key === "home.audiences.items") return arr.map((a) => ({ who: a.who, line: a.line, ctaLabel: a.cta?.label ?? "", ctaHref: a.cta?.href ?? "" }));
  if (key === "home.chain.steps") return arr.map((s) => ({ ...s, recorded: (s.recorded ?? []).join(", ") }));
  return arr.map((x) => ({ ...x }));
};
const fromRows = (key: string, rows: Row[]): unknown => {
  if (key === "home.audiences.items") return rows.map((r) => ({ who: r.who, line: r.line, cta: { label: r.ctaLabel, href: r.ctaHref } }));
  if (key === "home.chain.steps") return rows.map((r) => ({ key: r.key, name: r.name, nameNe: r.nameNe, title: r.title, body: r.body, recorded: (r.recorded ?? "").split(",").map((x) => x.trim()).filter(Boolean) }));
  return rows;
};

export function WebsiteEditor({ entries, images }: { entries: Entry[]; images: { id: string; label: string }[] }) {
  const groups = useMemo(() => [...new Set(entries.map((e) => e.group))], [entries]);
  const [group, setGroup] = useState(groups[0]!);
  const [values, setValues] = useState<Record<string, unknown>>(() => Object.fromEntries(entries.map((e) => [e.key, e.value])));
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const set = (key: string, v: unknown) => {
    setValues((x) => ({ ...x, [key]: v }));
    setChanged((c) => new Set(c).add(key));
  };
  const save = () =>
    start(async () => {
      const r = await saveContentAction([...changed].map((key) => ({ key, value: values[key] })));
      if (r.ok) {
        toast(`Saved ${changed.size} change${changed.size === 1 ? "" : "s"}`);
        setChanged(new Set());
        router.refresh();
      } else toast(r.error, "error");
    });

  return (
    <div className={st.grid2} style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
      <nav className={st.tabs} aria-label="Content sections">
        {groups.map((g) => (
          <a
            key={g}
            href={`#${g}`}
            aria-current={g === group ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              setGroup(g);
            }}
          >
            {g}
            {entries.some((e) => e.group === g && changed.has(e.key)) ? " •" : ""}
          </a>
        ))}
      </nav>
      <section className={st.panel} aria-label={group}>
        <div className={st.form}>
          {entries
            .filter((e) => e.group === group)
            .map((e) => {
              const v = values[e.key];
              const id = `c-${e.key}`;
              if (e.kind === "text")
                return (
                  <label key={e.key} className="field" htmlFor={id}>
                    <span>{e.label}</span>
                    {(e.max ?? 0) > 160 ? (
                      <textarea id={id} className="textarea" rows={3} value={String(v ?? "")} maxLength={e.max} onChange={(x) => set(e.key, x.target.value)} />
                    ) : (
                      <input id={id} className="input" value={String(v ?? "")} maxLength={e.max} onChange={(x) => set(e.key, x.target.value)} />
                    )}
                    <span className="hint">
                      {e.help ? `${e.help} ` : ""}
                      {e.max ? `${String(v ?? "").length}/${e.max}` : ""}
                    </span>
                  </label>
                );
              if (e.kind === "richtext")
                return (
                  <label key={e.key} className="field" htmlFor={id}>
                    <span>{e.label}</span>
                    <textarea id={id} className="textarea" rows={10} value={String(v ?? "")} onChange={(x) => set(e.key, x.target.value)} />
                    <span className="hint">{e.help ?? "Paragraphs separated by a blank line. ## for headings, - for lists, **bold**."}</span>
                  </label>
                );
              if (e.kind === "boolean")
                return (
                  <label key={e.key} className={st.check}>
                    <input type="checkbox" checked={Boolean(v)} onChange={(x) => set(e.key, x.target.checked)} />
                    {e.label}
                  </label>
                );
              if (e.kind === "link") {
                const l = (v as { label: string; href: string }) ?? { label: "", href: "" };
                return (
                  <fieldset key={e.key} className={st.formGrid} style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend className="label" style={{ marginBottom: 6 }}>
                      {e.label}
                    </legend>
                    <input className="input" aria-label={`${e.label} text`} value={l.label} onChange={(x) => set(e.key, { ...l, label: x.target.value })} placeholder="Button text" />
                    <input className="input" aria-label={`${e.label} link`} value={l.href} onChange={(x) => set(e.key, { ...l, href: x.target.value })} placeholder="/market" />
                  </fieldset>
                );
              }
              if (e.kind === "image")
                return (
                  <label key={e.key} className="field">
                    <span>{e.label}</span>
                    <select className="select" value={String(v ?? "")} onChange={(x) => set(e.key, x.target.value || null)}>
                      <option value="">No image</option>
                      {images.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.label}
                        </option>
                      ))}
                    </select>
                    <span className="hint">Upload images under Media first.</span>
                  </label>
                );
              const shape = LIST_SHAPES[e.key];
              if (!shape) return null;
              const rows = toRows(e.key, v);
              const update = (rs: Row[]) => set(e.key, fromRows(e.key, rs));
              return (
                <fieldset key={e.key} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 10 }}>
                  <legend className="label" style={{ marginBottom: 6 }}>
                    {e.label}
                  </legend>
                  {rows.map((r, i) => (
                    <div key={i} className={st.panel} style={{ background: "var(--mist)", marginTop: 0 }}>
                      <div className={st.formGrid}>
                        {shape.fields.map(([f, label, type]) =>
                          type === "area" ? (
                            <label key={f} className="field" style={{ gridColumn: "1 / -1" }}>
                              <span>{label}</span>
                              <textarea className="textarea" rows={3} value={r[f] ?? ""} onChange={(x) => update(rows.map((y, j) => (j === i ? { ...y, [f]: x.target.value } : y)))} />
                            </label>
                          ) : (
                            <label key={f} className="field">
                              <span>{label}</span>
                              <input className={`input ${f === "nameNe" ? "deva" : ""}`} value={r[f] ?? ""} onChange={(x) => update(rows.map((y, j) => (j === i ? { ...y, [f]: x.target.value } : y)))} />
                            </label>
                          ),
                        )}
                      </div>
                      {!shape.fixed ? (
                        <div className={st.inline} style={{ marginTop: 10 }}>
                          <button type="button" className="btn btn-ghost btn-small" disabled={i === 0} onClick={() => update(rows.map((y, j) => (j === i - 1 ? rows[i]! : j === i ? rows[i - 1]! : y)))}>
                            Move up
                          </button>
                          <button type="button" className="btn btn-ghost btn-small" onClick={() => update(rows.filter((_, j) => j !== i))}>
                            Remove
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {!shape.fixed ? (
                    <button type="button" className="btn btn-ghost btn-small" style={{ justifySelf: "start" }} onClick={() => update([...rows, { ...shape.blank }])}>
                      + Add
                    </button>
                  ) : null}
                </fieldset>
              );
            })}
        </div>
      </section>
      <div className={st.panel} style={{ position: "sticky", bottom: 12, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 10px 30px -18px rgb(10 25 18 / .5)" }}>
        <span className="small">{changed.size ? `${changed.size} unsaved change${changed.size === 1 ? "" : "s"}` : "All changes saved"}</span>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          style={{ marginLeft: "auto" }}
          disabled={!changed.size || pending}
          onClick={() => {
            setValues(Object.fromEntries(entries.map((e) => [e.key, e.value])));
            setChanged(new Set());
          }}
        >
          Cancel
        </button>
        <button type="button" className="btn btn-small" disabled={!changed.size || pending} onClick={save}>
          {pending ? "Saving…" : "Save & publish"}
        </button>
      </div>
    </div>
  );
}
