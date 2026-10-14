"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveInlineContent, setEditMode } from "@/app/actions/edit";
import styles from "./EditorBar.module.css";

interface Change {
  key: string;
  value: unknown;
  el: HTMLElement;
  original: { text: string; href?: string };
}

/**
 * Visible only to signed-in editors. Toggles "Edit website" mode, then turns
 * every [data-edit-key] region into an in-place editor. Nothing is written until
 * Save, which goes through an authorised, validated server action.
 */
export function EditorBar({ label, editing }: { label: string; editing: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [changes, setChanges] = useState<Map<string, Change>>(new Map());
  const [preview, setPreview] = useState(false);
  const [linkEdit, setLinkEdit] = useState<{ el: HTMLAnchorElement; key: string; label: string; href: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /** bumped after each save so the editor re-reads its baseline from the page */
  const [epoch, setEpoch] = useState(0);
  const changesRef = useRef(changes);
  changesRef.current = changes;

  const record = useCallback((key: string, el: HTMLElement, value: unknown, original: Change["original"]) => {
    setChanges((prev) => {
      const next = new Map(prev);
      const existing = next.get(key);
      const orig = existing?.original ?? original;
      const unchanged =
        typeof value === "string" ? value === orig.text : JSON.stringify(value) === JSON.stringify({ label: orig.text, href: orig.href });
      if (unchanged) next.delete(key);
      else next.set(key, { key, value, el, original: orig });
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-editing", editing && !preview);
    if (!editing || preview) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-edit-key]"));
    const originals = new Map<HTMLElement, Change["original"]>();
    els.forEach((el) => {
      originals.set(el, { text: el.innerText.trim(), href: el.getAttribute("data-edit-href") ?? undefined });
      if (el.dataset.editKind === "text") {
        el.setAttribute("contenteditable", "plaintext-only");
        el.setAttribute("role", "textbox");
        el.setAttribute("aria-label", `Edit ${el.dataset.editLabel}`);
        if (el.dataset.editMultiline) el.setAttribute("aria-multiline", "true");
      }
    });

    const onInput = (e: Event) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-edit-key]");
      if (!el || el.dataset.editKind !== "text") return;
      const max = Number(el.dataset.editMax || 0);
      let text = el.innerText.replace(/ /g, " ");
      if (!el.dataset.editMultiline) text = text.replace(/\s*\n\s*/g, " ");
      text = text.trim();
      el.toggleAttribute("data-over", Boolean(max && text.length > max));
      const orig = changesRef.current.get(el.dataset.editKey!)?.original ?? originals.get(el)!;
      record(el.dataset.editKey!, el, text, orig);
    };
    const onKey = (e: KeyboardEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-edit-key]");
      if (!el) return;
      if (e.key === "Enter" && !el.dataset.editMultiline) {
        e.preventDefault();
        el.blur();
      }
      if (e.key === "Escape") {
        const orig = changesRef.current.get(el.dataset.editKey!)?.original ?? originals.get(el)!;
        el.innerText = orig.text;
        record(el.dataset.editKey!, el, orig.text, orig);
        el.blur();
      }
    };
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-edit-key]");
      if (!el) return;
      // Inside edit mode, links don't navigate — they open their editor.
      const anchor = (e.target as HTMLElement).closest("a");
      if (anchor) e.preventDefault();
      if (el.dataset.editKind === "link" && el instanceof HTMLAnchorElement) {
        const pending = changesRef.current.get(el.dataset.editKey!);
        const v = (pending?.value as { label: string; href: string } | undefined) ?? { label: el.innerText.trim(), href: el.dataset.editHref ?? "" };
        setLinkEdit({ el, key: el.dataset.editKey!, label: v.label, href: v.href });
      }
    };
    document.addEventListener("input", onInput);
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("input", onInput);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick, true);
      els.forEach((el) => {
        el.removeAttribute("contenteditable");
        el.removeAttribute("role");
        el.removeAttribute("aria-label");
      });
    };
  }, [editing, preview, record, epoch]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (changesRef.current.size) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const cancel = () => {
    changes.forEach((c) => {
      c.el.innerText = c.original.text;
      c.el.removeAttribute("data-over");
    });
    setChanges(new Map());
    setPreview(false);
  };

  const save = () => {
    const payload = Array.from(changes.values()).map((c) => ({ key: c.key, value: c.value }));
    start(async () => {
      const res = await saveInlineContent(payload);
      if (res.ok) {
        setChanges(new Map());
        setPreview(false);
        setEpoch((n) => n + 1);
        setToast(`Saved ${res.saved} change${res.saved === 1 ? "" : "s"}`);
        router.refresh();
      } else setToast(res.error);
    });
  };

  const toggle = () =>
    start(async () => {
      if (editing && changes.size && !window.confirm("Discard unsaved changes?")) return;
      if (editing) cancel();
      await setEditMode(!editing);
      router.refresh();
    });

  return (
    <>
      <div className={styles.bar} role="region" aria-label="Editor tools" data-editing={editing || undefined}>
        <span className={styles.who} title="Visible only to signed-in editors">
          <span className={styles.dot} aria-hidden="true" />
          {label}
        </span>
        {editing ? (
          <>
            <span className={styles.status} aria-live="polite">
              {changes.size ? `${changes.size} unsaved change${changes.size === 1 ? "" : "s"}` : "Click any outlined text to edit"}
            </span>
            <button type="button" className={styles.btn} onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
              {preview ? "Back to editing" : "Preview"}
            </button>
            <button type="button" className={styles.btn} onClick={cancel} disabled={!changes.size || pending}>
              Cancel
            </button>
            <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={save} disabled={!changes.size || pending}>
              {pending ? "Saving…" : "Save"}
            </button>
            <button type="button" className={styles.btn} onClick={toggle} disabled={pending}>
              Done
            </button>
          </>
        ) : (
          <>
            <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={toggle} disabled={pending}>
              Edit website
            </button>
            <Link href="/studio" className={styles.btn}>
              Studio
            </Link>
          </>
        )}
      </div>
      {linkEdit ? (
        <LinkEditor
          initial={linkEdit}
          onClose={() => setLinkEdit(null)}
          onApply={(v) => {
            const orig = changes.get(linkEdit.key)?.original ?? { text: linkEdit.el.innerText.trim(), href: linkEdit.el.dataset.editHref };
            linkEdit.el.innerText = v.label;
            record(linkEdit.key, linkEdit.el, v, orig);
            setLinkEdit(null);
          }}
        />
      ) : null}
      {toast ? (
        <div className={styles.toast} role="status">
          {toast}
        </div>
      ) : null}
    </>
  );
}

function LinkEditor({
  initial,
  onClose,
  onApply,
}: {
  initial: { label: string; href: string };
  onClose: () => void;
  onApply: (v: { label: string; href: string }) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [label, setLabel] = useState(initial.label);
  const [href, setHref] = useState(initial.href);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const valid = href === "" || href.startsWith("/") || /^https?:\/\//.test(href) || /^mailto:|^tel:/.test(href);
  return (
    <dialog ref={ref} className={styles.dialog} onClose={onClose} aria-labelledby="link-editor-title">
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onApply({ label: label.trim(), href: href.trim() });
        }}
      >
        <h2 id="link-editor-title" className="h3">
          Edit button
        </h2>
        <label className="field">
          <span>Text</span>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} required />
        </label>
        <label className="field">
          <span>Goes to</span>
          <input className="input" value={href} onChange={(e) => setHref(e.target.value)} aria-invalid={!valid} placeholder="/market" />
          <span className="hint">A page on this site (starting with /), or a full https:// link.</span>
        </label>
        <div className={styles.dialogActions}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={!valid}>
            Apply
          </button>
        </div>
      </form>
    </dialog>
  );
}
