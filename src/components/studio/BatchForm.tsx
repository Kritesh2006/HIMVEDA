"use client";

import { useMemo, useState, useTransition } from "react";
import { createBatchAction } from "@/app/studio/actions";
import { useToast } from "./ui";
import st from "./studio.module.css";

interface R {
  id: string;
  receiptNo: string;
  commodity: string;
  centerId: string;
  centerCode: string;
  farmer: string;
  acceptedKg: number;
}

export function BatchForm({ receipts, centers, products }: { receipts: R[]; centers: { id: string; label: string }[]; products: { id: string; label: string }[] }) {
  const [centerId, setCenterId] = useState(receipts[0]?.centerId ?? centers[0]?.id ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const toast = useToast();
  const available = receipts.filter((r) => r.centerId === centerId);
  const commodities = useMemo(() => [...new Set(available.map((r) => r.commodity))], [available]);
  const [commodity, setCommodity] = useState("");
  const chosen = available.filter((r) => selected.includes(r.id));
  const kg = chosen.reduce((s, r) => s + r.acceptedKg, 0);

  return (
    <form
      className={st.form}
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const r = await createBatchAction({
            collectionCenterId: centerId,
            commodity: commodity || chosen[0]?.commodity.replace(/\s*\(.*\)$/, "") || "",
            receiptIds: selected,
            productId: f.get("productId") || undefined,
            publicSummary: f.get("publicSummary") || undefined,
          });
          if (r && !r.ok) toast(r.error, "error");
        });
      }}
    >
      <div className={st.formGrid}>
        <label className="field">
          <span>Originating centre</span>
          <select
            className="select"
            value={centerId}
            onChange={(e) => {
              setCenterId(e.target.value);
              setSelected([]);
            }}
          >
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <span className="hint">Its code becomes part of the batch number.</span>
        </label>
        <label className="field">
          <span>Commodity (public name)</span>
          <input className="input" value={commodity} onChange={(e) => setCommodity(e.target.value)} placeholder={commodities[0]?.replace(/\s*\(.*\)$/, "") ?? "e.g. Large cardamom"} />
        </label>
        <label className="field">
          <span>Product sold from this batch</span>
          <select name="productId" className="select" defaultValue="">
            <option value="">None yet</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 8 }}>
          Procured receipts at this centre not yet in a batch
        </legend>
        {available.length ? (
          <table className={st.table}>
            <tbody>
              {available.map((r) => (
                <tr key={r.id}>
                  <td>
                    <label className={st.check}>
                      <input
                        type="checkbox"
                        checked={selected.includes(r.id)}
                        onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))}
                      />
                      <span className="code">{r.receiptNo}</span>
                    </label>
                  </td>
                  <td>{r.commodity}</td>
                  <td>{r.farmer}</td>
                  <td className={st.num}>{r.acceptedKg.toFixed(1)} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={st.empty}>Nothing available at this centre. Procure accepted deliveries under Collection first.</p>
        )}
      </fieldset>
      <label className="field">
        <span>Public summary</span>
        <input name="publicSummary" className="input" maxLength={400} placeholder="One line for the trace page, e.g. two hillside plots in Taplejung" />
      </label>
      <p className="small">
        {selected.length} receipt{selected.length === 1 ? "" : "s"} · <strong>{kg.toFixed(1)} kg</strong> accepted
      </p>
      <button type="submit" className="btn" disabled={!selected.length || pending} style={{ justifySelf: "start" }}>
        {pending ? "Forming batch…" : "Form batch"}
      </button>
    </form>
  );
}
