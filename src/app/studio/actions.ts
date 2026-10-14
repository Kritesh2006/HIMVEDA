"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireEditor, UnauthorizedError } from "@/server/auth/session";
import { actorOf, type Actor } from "@/server/audit";
import * as catalog from "@/server/catalog/mutations";
import * as agri from "@/server/ops/agri";
import * as admin from "@/server/ops/admin";
import { saveContent } from "@/server/content/service";

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string; fields?: Record<string, string> };

/** Every Studio mutation goes through here: session check → work → cache revalidation. */
async function run<T>(fn: (actor: Actor) => Promise<T>, revalidate: string[] = [], message?: string): Promise<ActionResult<T>> {
  try {
    const session = await requireEditor();
    const data = await fn(actorOf(session));
    for (const p of revalidate) revalidatePath(p, p === "/" ? "layout" : "page");
    return { ok: true, data, message };
  } catch (e) {
    if (e instanceof UnauthorizedError) return { ok: false, error: "Your session has ended. Sign in again." };
    if (e instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const i of e.issues) fields[i.path.join(".")] ??= i.message;
      return { ok: false, error: e.issues[0]?.message ?? "Check the highlighted fields", fields };
    }
    if (e instanceof catalog.CatalogError || e instanceof agri.OpsError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong saving that change." };
  }
}

const formObj = (f: FormData) => {
  const o: Record<string, unknown> = {};
  for (const [k, v] of f.entries()) if (typeof v === "string") o[k] = v;
  for (const k of ["publishConsent", "isPublic", "passed"]) o[k] = f.get(k) === "on" || f.get(k) === "true";
  return o;
};

/* Products — every price change revalidates the whole site (home, market, product, cart are all derived from the DB). */
export async function createProductAction(input: unknown) {
  const res = await run((a) => catalog.createProduct(a, input), ["/studio/products"], "Draft created");
  return res;
}
export const saveDraftAction = async (id: string, input: unknown) => run((a) => catalog.saveProductDraft(a, id, input), ["/", `/studio/products/${id}`], "Draft saved");
export const publishAction = async (id: string, input?: unknown) => run((a) => catalog.publishProduct(a, id, input), ["/", "/studio/products"], "Published");
export const unpublishAction = async (id: string) => run((a) => catalog.unpublishProduct(a, id), ["/", "/studio/products"], "Unpublished");
export const discardDraftAction = async (id: string) => run((a) => catalog.discardProductDraft(a, id), [`/studio/products/${id}`], "Draft discarded");
export const archiveAction = async (id: string) => run((a) => catalog.archiveProduct(a, id), ["/", "/studio/products"], "Archived");
export const adjustStockAction = async (variantId: string, delta: number, reason: string) =>
  run((a) => catalog.adjustStock(a, variantId, delta, reason), ["/", "/studio/inventory"], "Stock updated");

/* Website content */
export const saveContentAction = async (changes: { key: string; value: unknown }[]) => run((a) => saveContent(a, changes), ["/"], "Website updated");

/* Producers & network */
export const saveFarmerAction = async (id: string | null, form: FormData) => run((a) => agri.saveFarmer(a, formObj(form), id ?? undefined), ["/studio/farmers"], "Producer saved");
export const saveCenterAction = async (id: string | null, form: FormData) => run((a) => agri.saveCenter(a, formObj(form), id ?? undefined), ["/", "/studio/collection"], "Centre saved");
export const recordReceiptAction = async (form: FormData) => run((a) => agri.recordReceipt(a, formObj(form)).then((r) => r.receiptNo), ["/studio/collection", "/studio"], "Receipt recorded");
export const inspectAction = async (receiptId: string, form: FormData) => run((a) => agri.inspectReceipt(a, receiptId, formObj(form)), ["/studio/collection", "/studio/quality"], "Inspection recorded");
export const procureAction = async (receiptId: string) => run((a) => agri.procureReceipt(a, receiptId), ["/studio/collection"], "Procured");
export const markPaidAction = async (paymentId: string, form: FormData) =>
  run((a) => agri.markPaymentPaid(a, paymentId, String(form.get("method") ?? ""), String(form.get("reference") ?? "")), ["/studio/collection", "/studio/farmers"], "Payment recorded");

/* Batches & trace */
export async function createBatchAction(input: unknown) {
  const res = await run((a) => agri.createBatch(a, input), ["/studio/traceability"], "Batch formed");
  if (res.ok && res.data) redirect(`/studio/traceability/${res.data.id}`);
  return res;
}
export const addEventAction = async (batchId: string, form: FormData) => run((a) => agri.addTraceEvent(a, batchId, formObj(form)), ["/", `/studio/traceability/${batchId}`], "Event added");
export const setBatchPublicAction = async (batchId: string, on: boolean) => run((a) => agri.setBatchPublic(a, batchId, on), ["/", `/studio/traceability/${batchId}`], on ? "Trace page published" : "Trace page hidden");
export const addRunAction = async (batchId: string, form: FormData) => run((a) => agri.addProcessingRun(a, batchId, formObj(form)), [`/studio/traceability/${batchId}`], "Processing logged");
export const addTestAction = async (batchId: string, form: FormData) => run((a) => agri.addQualityTest(a, batchId, formObj(form)), ["/", `/studio/traceability/${batchId}`, "/studio/quality"], "Check recorded");

/* Pricing */
export const refreshFxAction = async () => run((a) => admin.refreshFx(a), ["/", "/studio/pricing"], "Rates refreshed");
export const setRoundingAction = async (currency: string, rounding: string) => run((a) => admin.setRounding(a, currency, rounding), ["/", "/studio/pricing"], "Rounding saved");
export const createRateAction = async (form: FormData) => run((a) => admin.createRateRule(a, formObj(form)), ["/studio/pricing"], "Rate proposed for approval");
export const proposeRateAction = async (ruleId: string, form: FormData) =>
  run((a) => admin.proposeRate(a, ruleId, Number(form.get("rate")), String(form.get("note") ?? "")), ["/studio/pricing"], "Change sent for approval");
export const decideRateAction = async (approvalId: string, approve: boolean) => run((a) => admin.decideRate(a, approvalId, approve), ["/studio/pricing", "/studio"], approve ? "Approved" : "Rejected");

/* Orders, users, media, settings */
export const setOrderStatusAction = async (orderId: string, status: string) => run((a) => admin.setOrderStatus(a, orderId, status), ["/studio/orders", "/studio"], "Order updated");
export const updateUserAction = async (userId: string, form: FormData) =>
  run((a) => admin.updateUser(a, userId, { displayName: form.get("displayName"), role: form.get("role"), active: form.get("active") === "on" }), ["/studio/users"], "Saved");
export const revokeSessionAction = async (sessionId: string) => run((a) => admin.revokeSession(a, sessionId), ["/studio/users"], "Session signed out");
export const uploadMediaAction = async (form: FormData) => {
  const file = form.get("file");
  return run((a) => admin.uploadMedia(a, file as File, String(form.get("alt") ?? "")), ["/studio/media"], "Uploaded");
};
export const updateMediaAltAction = async (id: string, alt: string) => run((a) => admin.updateMediaAlt(a, id, alt), ["/studio/media"], "Saved");
export const deleteMediaAction = async (id: string) => run((a) => admin.deleteMedia(a, id), ["/studio/media"], "Deleted");
export const setDemoModeAction = async (on: boolean) => run((a) => admin.setDemoMode(a, on), ["/"], on ? "Demonstration mode on" : "Demonstration mode off");
export const removeDemoAction = async (form: FormData) => run((a) => admin.removeDemoData(a, String(form.get("confirm") ?? "")), ["/"], "Sample data removed");
export const setMessageHandledAction = async (id: string, handled: boolean) => run((a) => admin.setMessageHandled(a, id, handled), ["/studio", "/studio/orders"], "Updated");
