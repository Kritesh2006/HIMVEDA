"use client";

import { useActionState, useState } from "react";
import { submitContact, type FormState } from "@/app/actions/public";
import s from "./page.module.css";

const TOPICS = [
  ["order", "An order"],
  ["wholesale", "Wholesale or bulk buying"],
  ["producer", "Delivering produce"],
  ["partnership", "Partnership or distribution"],
  ["other", "Something else"],
] as const;

export function ContactForm({ topic }: { topic?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitContact, { ok: false });
  const [started] = useState(() => Date.now());
  if (state.ok)
    return (
      <div className={s.success} role="status">
        <h2 className="h2">Message sent.</h2>
        <p className="muted">It has reached the HIMVEDA team. Replies go to the email address you gave.</p>
      </div>
    );
  const err = state.errors ?? {};
  return (
    <form action={action} className={s.form} noValidate>
      <div className={s.formRow}>
        <label className="field">
          <span>Name</span>
          <input name="name" className="input" autoComplete="name" required aria-invalid={Boolean(err.name)} aria-describedby={err.name ? "e-name" : undefined} />
          {err.name ? <span id="e-name" className="error-text">{err.name}</span> : null}
        </label>
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" className="input" autoComplete="email" required aria-invalid={Boolean(err.email)} aria-describedby={err.email ? "e-email" : undefined} />
          {err.email ? <span id="e-email" className="error-text">{err.email}</span> : null}
        </label>
      </div>
      <label className="field">
        <span>About</span>
        <select name="topic" className="select" defaultValue={TOPICS.some(([v]) => v === topic) ? topic : "other"}>
          {TOPICS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Message</span>
        <textarea name="message" className="textarea" rows={6} required aria-invalid={Boolean(err.message)} aria-describedby={err.message ? "e-msg" : undefined} />
        {err.message ? <span id="e-msg" className="error-text">{err.message}</span> : null}
      </label>
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px" }}>
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <input type="hidden" name="startedAt" value={started} />
      <button type="submit" className="btn" disabled={pending} data-magnetic style={{ justifySelf: "start" }}>
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
