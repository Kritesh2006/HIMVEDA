"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EDIT_MODE_COOKIE, requireEditor } from "@/server/auth/session";
import { saveContent } from "@/server/content/service";
import { actorOf } from "@/server/audit";

export async function setEditMode(on: boolean) {
  await requireEditor();
  const jar = await cookies();
  if (on) jar.set(EDIT_MODE_COOKIE, "1", { path: "/", httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 8 });
  else jar.delete(EDIT_MODE_COOKIE);
  revalidatePath("/", "layout");
}

const changesSchema = z
  .array(z.object({ key: z.string().min(1).max(80), value: z.unknown() }))
  .min(1)
  .max(60);

/** Inline edit "Save": validated against the content registry, written atomically, audited per key. */
export async function saveInlineContent(input: unknown): Promise<{ ok: true; saved: number } | { ok: false; error: string }> {
  try {
    const session = await requireEditor();
    const changes = changesSchema.parse(input);
    const res = await saveContent(actorOf(session), changes.map((c) => ({ key: c.key, value: c.value })));
    revalidatePath("/", "layout");
    return { ok: true, saved: res.saved };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save" };
  }
}
