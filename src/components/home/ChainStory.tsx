"use client";

import { useEffect, useRef, useState } from "react";
import type { ChainStep } from "@/server/content/registry";
import s from "./home.module.css";

export interface SheetRow {
  label: string;
  value: string;
}

/**
 * The five checkpoints as a scroll story. On wide screens the record sheet is
 * sticky and updates as each checkpoint scrolls into focus; on small screens
 * each checkpoint carries its own sheet inline. No scroll-jacking.
 */
export function ChainStory({ steps, sheets, code, isSample }: { steps: ChainStep[]; sheets: SheetRow[][]; code: string | null; isSample: boolean }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(Number((visible.target as HTMLElement).dataset.index));
      },
      { rootMargin: "-40% 0px -45% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const sheet = (i: number) => (
    <div className={s.sheet} data-step={steps[i]?.key}>
      <div className={s.sheetHead}>
        <span>Recorded at {steps[i]?.name.toLowerCase()}</span>
        {code ? <span className="code">{code}</span> : null}
      </div>
      <dl className={s.sheetRows}>
        {(steps[i]?.recorded ?? []).map((field, j) => (
          <div key={field} className={s.sheetRow} style={{ ["--j" as string]: j }}>
            <dt>{field}</dt>
            <dd className="num">{sheets[i]?.[j]?.value ?? "—"}</dd>
          </div>
        ))}
      </dl>
      {isSample ? <p className={s.sheetNote}>Values from a sample batch.</p> : null}
    </div>
  );

  return (
    <div className={s.chain}>
      <div className={s.chainSticky} aria-hidden="true">
        <div className={s.chainProgress}>
          {steps.map((st, i) => (
            <span key={st.key} data-on={i <= active || undefined} data-current={i === active || undefined}>
              <i />
              <b className="deva" lang="ne">
                {st.nameNe}
              </b>
            </span>
          ))}
        </div>
        <div className={s.chainNumber}>
          <span className="num">{String(active + 1).padStart(2, "0")}</span>
          <span className={s.chainOf}>of {String(steps.length).padStart(2, "0")}</span>
        </div>
        <div key={active} className={s.sheetSwap}>
          {sheet(active)}
        </div>
      </div>

      <ol className={s.chainSteps} role="list">
        {steps.map((st, i) => (
          <li
            key={st.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-index={i}
            data-active={i === active || undefined}
            className={s.chainStep}
          >
            <p className={s.chainName}>
              <span className="num">{String(i + 1).padStart(2, "0")}</span> {st.name}
            </p>
            <h3 className="h2">{st.title}</h3>
            <p className={s.chainBody}>{st.body}</p>
            <div className={s.chainInlineSheet}>
              {sheet(i)}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
