"use server";

import { redirect } from "next/navigation";
import { attemptAccess } from "@/server/auth/access";
import { destroySession, getEditorSession } from "@/server/auth/session";
import { writeAudit } from "@/server/audit";

export type AccessState = { status: "idle" } | { status: "invalid" } | { status: "locked"; minutes: number } | { status: "unavailable" };

export async function enterStudio(_: AccessState, form: FormData): Promise<AccessState> {
  const code = String(form.get("code") ?? "").slice(0, 32);
  const res = await attemptAccess(code);
  if (res.ok) redirect("/studio");
  if (res.reason === "locked") return { status: "locked", minutes: res.retryAfterMinutes };
  if (res.reason === "unavailable") return { status: "unavailable" };
  return { status: "invalid" };
}

export async function signOut() {
  const s = await getEditorSession();
  if (s) await writeAudit({ userId: s.userId, label: s.label }, { action: "session.logout", entityType: "session", summary: `${s.label} signed out` });
  await destroySession();
  redirect("/owner");
}
