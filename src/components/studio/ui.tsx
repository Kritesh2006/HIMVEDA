"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/app/studio/actions";
import st from "./studio.module.css";

/* ── Toasts ── */
type Toast = { id: number; text: string; kind: "ok" | "error" };
const ToastCtx = createContext<(text: string, kind?: Toast["kind"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, kind }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === "error" ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className={st.toasts} role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={st.toast} data-kind={t.kind}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Runs a server action, shows the outcome as a toast and refreshes server data. */
export function useAction() {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = useCallback(
    <T,>(fn: () => Promise<ActionResult<T>>, opts: { confirm?: string; onOk?: (r: ActionResult<T>) => void; silent?: boolean } = {}) => {
      if (opts.confirm && !window.confirm(opts.confirm)) return;
      start(async () => {
        const r = await fn();
        if (r.ok) {
          if (!opts.silent && r.message) toast(r.message);
          opts.onOk?.(r);
          router.refresh();
        } else toast(r.error, "error");
      });
    },
    [router, toast],
  );
  return { run, pending };
}

export function ActionButton<T>({
  action,
  children,
  confirm,
  className = "btn btn-ghost btn-small",
  disabled,
}: {
  action: () => Promise<ActionResult<T>>;
  children: React.ReactNode;
  confirm?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { run, pending } = useAction();
  return (
    <button type="button" className={className} disabled={pending || disabled} onClick={() => run(action, { confirm })} aria-busy={pending}>
      {children}
    </button>
  );
}

/** A form bound to a server action taking FormData; shows field errors inline via data attributes. */
export function ActionForm({
  action,
  children,
  className,
  onDone,
  resetOnSuccess = true,
}: {
  action: (f: FormData) => Promise<ActionResult<unknown>>;
  children: React.ReactNode;
  className?: string;
  onDone?: () => void;
  resetOnSuccess?: boolean;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { run, pending } = useAction();
  return (
    <form
      ref={ref}
      className={className ?? st.form}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        run(
          async () => {
            const r = await action(fd);
            if (!r.ok) setError(r.error);
            return r;
          },
          {
            onOk: () => {
              if (resetOnSuccess) ref.current?.reset();
              onDone?.();
            },
          },
        );
      }}
      aria-busy={pending}
    >
      <fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0, display: "contents" }}>
        {children}
      </fieldset>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function Dialog({
  trigger,
  title,
  children,
  triggerClass = "btn btn-small",
}: {
  trigger: React.ReactNode;
  title: string;
  children: (close: () => void) => React.ReactNode;
  triggerClass?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open) ref.current?.showModal();
  }, [open]);
  const close = () => {
    ref.current?.close();
  };
  return (
    <>
      <button type="button" className={triggerClass} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {trigger}
      </button>
      {open ? (
        <dialog ref={ref} className={st.dialog} aria-label={title} onClose={() => setOpen(false)} onClick={(e) => e.target === ref.current && close()}>
          <div className={st.dialogHead}>
            <h2 className="h3">{title}</h2>
            <button type="button" className={st.close} onClick={close}>
              Close
            </button>
          </div>
          <div className={st.dialogBody}>{children(close)}</div>
        </dialog>
      ) : null}
    </>
  );
}
