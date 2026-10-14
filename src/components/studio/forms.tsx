"use client";

/**
 * Small client islands used by server-rendered Studio pages. Each binds a
 * server action; authorisation and validation happen on the server.
 */
import { useState } from "react";
import { ActionButton, ActionForm, Dialog, useAction } from "./ui";
import * as A from "@/app/studio/actions";
import st from "./studio.module.css";

type Opt = { id: string; label: string };

export function StockAdjust({ variantId }: { variantId: string }) {
  return (
    <ActionForm
      className={st.inline}
      action={(f) => A.adjustStockAction(variantId, Number(f.get("delta")), String(f.get("reason") ?? ""))}
    >
      <label className="sr-only" htmlFor={`d-${variantId}`}>
        Change
      </label>
      <input id={`d-${variantId}`} name="delta" className="input" inputMode="numeric" placeholder="+10 / −3" style={{ width: 96 }} required />
      <input name="reason" className="input" placeholder="Reason" style={{ width: 160 }} aria-label="Reason" />
      <button type="submit" className="btn btn-ghost btn-small">
        Apply
      </button>
    </ActionForm>
  );
}

export function OrderStatus({ orderId, status }: { orderId: string; status: string }) {
  const { run, pending } = useAction();
  return (
    <select
      className="select"
      value={status}
      disabled={pending || status === "cancelled"}
      aria-label="Order status"
      style={{ minHeight: 36, width: "auto" }}
      onChange={(e) => {
        const v = e.target.value;
        run(() => A.setOrderStatusAction(orderId, v), { confirm: v === "cancelled" ? "Cancel this order and return its stock?" : undefined });
      }}
    >
      {["requested", "confirmed", "packed", "shipped", "delivered", "cancelled"].map((s) => (
        <option key={s} value={s}>
          {s[0]!.toUpperCase() + s.slice(1)}
        </option>
      ))}
    </select>
  );
}

export function MessageToggle({ id, handled }: { id: string; handled: boolean }) {
  return (
    <ActionButton action={() => A.setMessageHandledAction(id, !handled)}>{handled ? "Reopen" : "Mark handled"}</ActionButton>
  );
}

export function FarmerDialog({
  farmer,
  label = "+ Register producer",
}: {
  farmer?: { id: string; fullName: string; publicName: string | null; publishConsent: boolean; phone: string | null; district: string; municipality: string | null; cooperative: string | null; notes: string | null; farm?: { name: string; altitudeM: number | null; approxLat: string | null; approxLng: string | null; crops: string[] } | null };
  label?: string;
}) {
  return (
    <Dialog trigger={label} title={farmer ? `Edit ${farmer.fullName}` : "Register a producer"} triggerClass={farmer ? "btn btn-ghost btn-small" : "btn btn-small"}>
      {(close) => (
        <ActionForm action={(f) => A.saveFarmerAction(farmer?.id ?? null, f)} onDone={close} resetOnSuccess={false}>
          <div className={st.formGrid}>
            <label className="field">
              <span>Full name (private)</span>
              <input name="fullName" className="input" defaultValue={farmer?.fullName} required />
            </label>
            <label className="field">
              <span>Phone (private)</span>
              <input name="phone" className="input" defaultValue={farmer?.phone ?? ""} />
            </label>
            <label className="field">
              <span>District</span>
              <input name="district" className="input" defaultValue={farmer?.district} required />
            </label>
            <label className="field">
              <span>Municipality</span>
              <input name="municipality" className="input" defaultValue={farmer?.municipality ?? ""} />
            </label>
            <label className="field">
              <span>Cooperative / group</span>
              <input name="cooperative" className="input" defaultValue={farmer?.cooperative ?? ""} />
            </label>
          </div>
          <fieldset className={st.panel} style={{ display: "grid", gap: 12 }}>
            <legend className="label">Public name</legend>
            <label className="field">
              <span>Name to show on trace pages</span>
              <input name="publicName" className="input" defaultValue={farmer?.publicName ?? ""} placeholder="e.g. a cooperative name" />
            </label>
            <label className={st.check}>
              <input type="checkbox" name="publishConsent" defaultChecked={farmer?.publishConsent} />
              The producer has agreed to have this name published
            </label>
          </fieldset>
          <div className={st.formGrid}>
            <label className="field">
              <span>Farm or plot name</span>
              <input name="farmName" className="input" defaultValue={farmer?.farm?.name ?? ""} />
            </label>
            <label className="field">
              <span>Altitude (m)</span>
              <input name="altitudeM" className="input" inputMode="numeric" defaultValue={farmer?.farm?.altitudeM ?? ""} />
            </label>
            <label className="field">
              <span>Approx. latitude</span>
              <input name="approxLat" className="input" inputMode="decimal" defaultValue={farmer?.farm?.approxLat ?? ""} placeholder="27.38" />
            </label>
            <label className="field">
              <span>Approx. longitude</span>
              <input name="approxLng" className="input" inputMode="decimal" defaultValue={farmer?.farm?.approxLng ?? ""} placeholder="87.65" />
            </label>
            <label className="field">
              <span>Crops (comma separated)</span>
              <input name="crops" className="input" defaultValue={farmer?.farm?.crops.join(", ") ?? ""} />
            </label>
          </div>
          <p className="hint">Coordinates are stored at two decimals (~1 km) and shown publicly only as a ~10 km area.</p>
          <label className="field">
            <span>Notes (private)</span>
            <textarea name="notes" className="textarea" rows={3} defaultValue={farmer?.notes ?? ""} />
          </label>
          <button type="submit" className="btn" style={{ justifySelf: "start" }}>
            Save producer
          </button>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function CenterDialog({ center }: { center?: { id: string; code: string; name: string; district: string; province: string | null; lat: string | null; lng: string | null; address: string | null; isPublic: boolean } }) {
  return (
    <Dialog trigger={center ? "Edit" : "+ Add centre"} title={center ? `Edit ${center.code}` : "Add a collection centre"} triggerClass={center ? "btn btn-ghost btn-small" : "btn btn-ghost btn-small"}>
      {(close) => (
        <ActionForm action={(f) => A.saveCenterAction(center?.id ?? null, f)} onDone={close} resetOnSuccess={false}>
          <div className={st.formGrid}>
            <label className="field">
              <span>Code (3 letters)</span>
              <input name="code" className="input" defaultValue={center?.code} maxLength={3} required />
              <span className="hint">Used in every batch code from this centre.</span>
            </label>
            <label className="field">
              <span>Name</span>
              <input name="name" className="input" defaultValue={center?.name} required />
            </label>
            <label className="field">
              <span>District</span>
              <input name="district" className="input" defaultValue={center?.district} required />
            </label>
            <label className="field">
              <span>Province</span>
              <input name="province" className="input" defaultValue={center?.province ?? ""} />
            </label>
            <label className="field">
              <span>Latitude</span>
              <input name="lat" className="input" defaultValue={center?.lat ?? ""} />
            </label>
            <label className="field">
              <span>Longitude</span>
              <input name="lng" className="input" defaultValue={center?.lng ?? ""} />
            </label>
          </div>
          <label className="field">
            <span>Address</span>
            <input name="address" className="input" defaultValue={center?.address ?? ""} />
          </label>
          <label className={st.check}>
            <input type="checkbox" name="isPublic" defaultChecked={center?.isPublic} />
            Show on the public website
          </label>
          <button type="submit" className="btn" style={{ justifySelf: "start" }}>
            Save centre
          </button>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function ReceiptDialog({ farmers, centers }: { farmers: Opt[]; centers: Opt[] }) {
  const [gross, setGross] = useState("");
  const [tare, setTare] = useState("");
  const net = Number(gross) - Number(tare || 0);
  return (
    <Dialog trigger="+ Record a delivery" title="Record a delivery">
      {(close) => (
        <ActionForm action={A.recordReceiptAction} onDone={close}>
          <div className={st.formGrid}>
            <label className="field">
              <span>Producer</span>
              <select name="farmerId" className="select" required defaultValue="">
                <option value="" disabled>
                  Choose…
                </option>
                {farmers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Collection centre</span>
              <select name="collectionCenterId" className="select" required defaultValue={centers[0]?.id}>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Commodity</span>
              <input name="commodity" className="input" required placeholder="Large cardamom (dried)" />
              <span className="hint">Use the same name as the centre’s procurement rate.</span>
            </label>
            <label className="field">
              <span>Harvest date</span>
              <input name="harvestDate" type="date" className="input" />
            </label>
            <label className="field">
              <span>Gross weight (kg)</span>
              <input name="grossKg" className="input" inputMode="decimal" required value={gross} onChange={(e) => setGross(e.target.value)} />
            </label>
            <label className="field">
              <span>Tare / sacks (kg)</span>
              <input name="tareKg" className="input" inputMode="decimal" value={tare} onChange={(e) => setTare(e.target.value)} />
            </label>
            <label className="field">
              <span>Moisture % (optional)</span>
              <input name="moisturePct" className="input" inputMode="decimal" />
            </label>
          </div>
          <p className="small">
            Net weight: <strong className="num">{Number.isFinite(net) && net > 0 ? `${net.toFixed(1)} kg` : "—"}</strong>
          </p>
          <label className="field">
            <span>Notes</span>
            <textarea name="notes" className="textarea" rows={2} />
          </label>
          <button type="submit" className="btn" style={{ justifySelf: "start" }}>
            Issue receipt
          </button>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function InspectDialog({ receiptId, receiptNo, netKg }: { receiptId: string; receiptNo: string; netKg: number }) {
  return (
    <Dialog trigger="Inspect" title={`Inspect ${receiptNo}`} triggerClass="btn btn-small">
      {(close) => (
        <ActionForm action={(f) => A.inspectAction(receiptId, f)} onDone={close}>
          <div className={st.formGrid}>
            <label className="field">
              <span>Visual grade</span>
              <select name="visualGrade" className="select" defaultValue="A">
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="ungraded">Not graded</option>
              </select>
            </label>
            <label className="field">
              <span>Moisture %</span>
              <input name="moisturePct" className="input" inputMode="decimal" />
            </label>
            <label className="field">
              <span>Foreign matter %</span>
              <input name="foreignMatterPct" className="input" inputMode="decimal" />
            </label>
            <label className="field">
              <span>Accepted (kg)</span>
              <input name="acceptedKg" className="input" inputMode="decimal" defaultValue={netKg} required />
              <span className="hint">Net received: {netKg} kg</span>
            </label>
            <label className="field">
              <span>Result</span>
              <select name="result" className="select" defaultValue="pass">
                <option value="pass">Pass — accept</option>
                <option value="hold">Hold — recheck</option>
                <option value="fail">Fail — reject</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>Notes</span>
            <textarea name="notes" className="textarea" rows={2} />
          </label>
          <button type="submit" className="btn" style={{ justifySelf: "start" }}>
            Record inspection
          </button>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function ProcureButton({ receiptId }: { receiptId: string }) {
  return (
    <ActionButton action={() => A.procureAction(receiptId)} className="btn btn-small" confirm="Buy the accepted quantity at the approved rate?">
      Procure
    </ActionButton>
  );
}

export function PayDialog({ paymentId, amount }: { paymentId: string; amount: string }) {
  return (
    <Dialog trigger="Mark paid" title={`Record payment of ${amount}`} triggerClass="btn btn-ghost btn-small">
      {(close) => (
        <ActionForm action={(f) => A.markPaidAction(paymentId, f)} onDone={close}>
          <label className="field">
            <span>Method</span>
            <input name="method" className="input" required placeholder="Bank transfer, wallet, cash…" />
          </label>
          <label className="field">
            <span>Reference</span>
            <input name="reference" className="input" />
          </label>
          <button type="submit" className="btn" style={{ justifySelf: "start" }}>
            Record payment
          </button>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function RefreshFx() {
  return (
    <ActionButton action={A.refreshFxAction} className="btn btn-ghost btn-small">
      Refresh rates
    </ActionButton>
  );
}

export function RoundingSelect({ currency, value }: { currency: string; value: string }) {
  const { run, pending } = useAction();
  return (
    <select className="select" defaultValue={value} disabled={pending} style={{ minHeight: 34, width: "auto" }} aria-label={`${currency} rounding`} onChange={(e) => run(() => A.setRoundingAction(currency, e.target.value))}>
      <option value="none">Exact</option>
      <option value="whole">Whole units</option>
      <option value="half">Nearest .50</option>
      <option value="charm_99">Ends in .99</option>
    </select>
  );
}

export function NewRateDialog({ centers }: { centers: Opt[] }) {
  return (
    <Dialog trigger="+ New rate" title="Propose a procurement rate" triggerClass="btn btn-ghost btn-small">
      {(close) => (
        <ActionForm action={A.createRateAction} onDone={close}>
          <label className="field">
            <span>Commodity</span>
            <input name="commodity" className="input" required placeholder="Large cardamom (dried)" />
            <span className="hint">Must match the commodity name used on receipts.</span>
          </label>
          <label className="field">
            <span>Collection centre</span>
            <select name="collectionCenterId" className="select" required>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Rate (NPR per kg, grade A)</span>
            <input name="ratePerKg" className="input" inputMode="decimal" required />
          </label>
          <p className="hint">The rate becomes active only after a different editor approves it.</p>
          <button type="submit" className="btn" style={{ justifySelf: "start" }}>
            Send for approval
          </button>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function ProposeRateDialog({ ruleId, name }: { ruleId: string; name: string }) {
  return (
    <Dialog trigger="Change" title={`Change rate: ${name}`} triggerClass="btn btn-ghost btn-small">
      {(close) => (
        <ActionForm action={(f) => A.proposeRateAction(ruleId, f)} onDone={close}>
          <label className="field">
            <span>New rate (NPR per kg)</span>
            <input name="rate" className="input" inputMode="decimal" required />
          </label>
          <label className="field">
            <span>Reason</span>
            <input name="note" className="input" />
          </label>
          <button type="submit" className="btn" style={{ justifySelf: "start" }}>
            Send for approval
          </button>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function DecideButtons({ approvalId }: { approvalId: string }) {
  return (
    <span className={st.inline}>
      <ActionButton action={() => A.decideRateAction(approvalId, true)} className="btn btn-small" confirm="Approve this rate? It applies to new procurements immediately.">
        Approve
      </ActionButton>
      <ActionButton action={() => A.decideRateAction(approvalId, false)}>Reject</ActionButton>
    </span>
  );
}

export function UserForm({ user, isSelf }: { user: { id: string; displayName: string; role: string; active: boolean }; isSelf: boolean }) {
  return (
    <ActionForm className={st.inline} action={(f) => A.updateUserAction(user.id, f)} resetOnSuccess={false}>
      <input name="displayName" className="input" defaultValue={user.displayName} aria-label="Display name" style={{ width: 180 }} />
      <select name="role" className="select" defaultValue={user.role} aria-label="Role">
        <option value="owner">Owner</option>
        <option value="editor">Editor</option>
      </select>
      <label className={st.check}>
        <input type="checkbox" name="active" defaultChecked={user.active} disabled={isSelf} />
        Active
      </label>
      {isSelf ? <input type="hidden" name="active" value="on" /> : null}
      <button type="submit" className="btn btn-ghost btn-small">
        Save
      </button>
    </ActionForm>
  );
}

export function RevokeButton({ sessionId }: { sessionId: string }) {
  return (
    <ActionButton action={() => A.revokeSessionAction(sessionId)} confirm="Sign this session out?">
      Sign out
    </ActionButton>
  );
}

export function UploadForm() {
  return (
    <ActionForm action={A.uploadMediaAction} className={st.inline}>
      <input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/avif,application/pdf" required aria-label="File" />
      <input name="alt" className="input" placeholder="Describe the image" aria-label="Description" style={{ width: 240 }} />
      <button type="submit" className="btn btn-small">
        Upload
      </button>
    </ActionForm>
  );
}

export function MediaAlt({ id, alt }: { id: string; alt: string }) {
  return (
    <ActionForm className={st.inline} action={(f) => A.updateMediaAltAction(id, String(f.get("alt") ?? ""))} resetOnSuccess={false}>
      <input name="alt" className="input" defaultValue={alt} aria-label="Description" style={{ width: "100%", minWidth: 0 }} />
      <button type="submit" className="btn btn-ghost btn-small">
        Save
      </button>
    </ActionForm>
  );
}

export function DeleteMedia({ id }: { id: string }) {
  return (
    <ActionButton action={() => A.deleteMediaAction(id)} confirm="Delete this file permanently?">
      Delete
    </ActionButton>
  );
}

export function DemoToggle({ on }: { on: boolean }) {
  return (
    <ActionButton action={() => A.setDemoModeAction(!on)} className="btn btn-small">
      {on ? "Turn off demonstration mode" : "Turn on demonstration mode"}
    </ActionButton>
  );
}

export function PurgeDemo() {
  return (
    <ActionForm action={A.removeDemoAction}>
      <label className="field">
        <span>Type REMOVE SAMPLE DATA to confirm</span>
        <input name="confirm" className="input" autoComplete="off" style={{ maxWidth: 320 }} />
      </label>
      <button type="submit" className={`btn btn-small ${st.danger}`} style={{ justifySelf: "start" }}>
        Remove all sample data
      </button>
    </ActionForm>
  );
}

export function BatchPublicToggle({ batchId, isPublic }: { batchId: string; isPublic: boolean }) {
  return (
    <ActionButton action={() => A.setBatchPublicAction(batchId, !isPublic)} className={isPublic ? "btn btn-ghost btn-small" : "btn btn-small"}>
      {isPublic ? "Hide trace page" : "Publish trace page"}
    </ActionButton>
  );
}

export function EventDialog({ batchId }: { batchId: string }) {
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return (
    <Dialog trigger="+ Add event" title="Add a trace event" triggerClass="btn btn-ghost btn-small">
      {(close) => (
        <ActionForm action={(f) => A.addEventAction(batchId, f)} onDone={close}>
          <div className={st.formGrid}>
            <label className="field">
              <span>Stage</span>
              <select name="stage" className="select" defaultValue="packaged">
                {["origin", "collected", "inspected", "verified", "processed", "packaged", "available", "sold_out"].map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>When</span>
              <input name="occurredAt" type="datetime-local" className="input" defaultValue={now} required />
            </label>
          </div>
          <label className="field">
            <span>Title (public)</span>
            <input name="title" className="input" required />
          </label>
          <label className="field">
            <span>Description (public)</span>
            <textarea name="publicDescription" className="textarea" rows={2} />
          </label>
          <div className={st.formGrid}>
            <label className="field">
              <span>Location (public)</span>
              <input name="locationLabel" className="input" />
            </label>
            <label className="field">
              <span>Metric</span>
              <select name="metricKey" className="select" defaultValue="">
                <option value="">None</option>
                <option value="netKg">Net weight (kg)</option>
                <option value="acceptedKg">Accepted (kg)</option>
                <option value="outKg">Output (kg)</option>
                <option value="packs">Packs</option>
              </select>
            </label>
            <label className="field">
              <span>Value</span>
              <input name="metricValue" className="input" inputMode="decimal" />
            </label>
          </div>
          <label className="field">
            <span>Private notes</span>
            <textarea name="privateNotes" className="textarea" rows={2} />
          </label>
          <label className={st.check}>
            <input type="checkbox" name="isPublic" defaultChecked />
            Show on the public trace page
          </label>
          <button type="submit" className="btn" style={{ justifySelf: "start" }}>
            Add event
          </button>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function RunDialog({ batchId }: { batchId: string }) {
  return (
    <Dialog trigger="+ Log processing" title="Log a processing run" triggerClass="btn btn-ghost btn-small">
      {(close) => (
        <ActionForm action={(f) => A.addRunAction(batchId, f)} onDone={close}>
          <div className={st.formGrid}>
            <label className="field">
              <span>Process</span>
              <input name="process" className="input" required placeholder="Drying, grading, packing…" />
            </label>
            <label className="field">
              <span>Input (kg)</span>
              <input name="inputKg" className="input" inputMode="decimal" required />
            </label>
            <label className="field">
              <span>Output (kg)</span>
              <input name="outputKg" className="input" inputMode="decimal" />
            </label>
            <label className="field">
              <span>Packs sealed</span>
              <input name="unitsPacked" className="input" inputMode="numeric" />
            </label>
          </div>
          <label className="field">
            <span>Notes</span>
            <textarea name="notes" className="textarea" rows={2} />
          </label>
          <button type="submit" className="btn" style={{ justifySelf: "start" }}>
            Save run
          </button>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function TestDialog({ batchId, documents }: { batchId: string; documents: Opt[] }) {
  return (
    <Dialog trigger="+ Record a check" title="Record a quality check" triggerClass="btn btn-ghost btn-small">
      {(close) => (
        <ActionForm action={(f) => A.addTestAction(batchId, f)} onDone={close}>
          <div className={st.formGrid}>
            <label className="field">
              <span>Check</span>
              <input name="testType" className="input" required placeholder="Moisture" />
            </label>
            <label className="field">
              <span>Method</span>
              <input name="method" className="input" placeholder="Moisture meter" />
            </label>
            <label className="field">
              <span>Result</span>
              <input name="resultValue" className="input" inputMode="decimal" />
            </label>
            <label className="field">
              <span>Unit</span>
              <input name="resultUnit" className="input" placeholder="%" />
            </label>
            <label className="field">
              <span>Limit</span>
              <input name="limitText" className="input" placeholder="≤ 12%" />
            </label>
            <label className="field">
              <span>Performed by</span>
              <input name="performedBy" className="input" required placeholder="In-house, or the lab’s name" />
            </label>
          </div>
          <label className="field">
            <span>Report document</span>
            <select name="documentMediaId" className="select" defaultValue="">
              <option value="">No document</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            <span className="hint">Only attach a real report. Upload PDFs under Media first.</span>
          </label>
          <label className={st.check}>
            <input type="checkbox" name="passed" defaultChecked />
            Within limit
          </label>
          <label className={st.check}>
            <input type="checkbox" name="isPublic" defaultChecked />
            Show on the public trace page
          </label>
          <button type="submit" className="btn" style={{ justifySelf: "start" }}>
            Record check
          </button>
        </ActionForm>
      )}
    </Dialog>
  );
}
