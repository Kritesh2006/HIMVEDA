import "server-only";
import { cache } from "react";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { writeAudit, type Actor } from "@/server/audit";
import { CONTENT, isContentKey, type ContentKey, type ContentMap } from "./registry";
import { validateContent } from "./validate";

export { validateContent };

/** Load every content value once per request, merged over registry defaults. */
export const getContent = cache(async (): Promise<ContentMap> => {
  const rows = await db.select({ key: schema.siteContent.key, value: schema.siteContent.value }).from(schema.siteContent);
  const out = Object.fromEntries(Object.entries(CONTENT).map(([k, d]) => [k, d.default])) as Record<string, unknown>;
  for (const r of rows) if (isContentKey(r.key)) out[r.key] = r.value;
  return out as ContentMap;
});

const preview = (v: unknown) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
};

/** Validate and persist a batch of content changes atomically, auditing each. */
export async function saveContent(actor: Actor, changes: { key: string; value: unknown }[]): Promise<{ saved: number }> {
  const valid: { key: ContentKey; value: unknown }[] = [];
  for (const c of changes) {
    const v = validateContent(c.key, c.value);
    if (!v.ok) throw new Error(v.error);
    valid.push({ key: v.key, value: v.value });
  }
  if (!valid.length) return { saved: 0 };
  const current = await getContentFresh(valid.map((v) => v.key));
  await db.transaction(async (tx) => {
    for (const { key, value } of valid) {
      const before = current[key];
      if (JSON.stringify(before) === JSON.stringify(value)) continue;
      await tx
        .insert(schema.siteContent)
        .values({ key, kind: CONTENT[key].kind === "boolean" ? "json" : CONTENT[key].kind, value: value as object, updatedById: actor.userId })
        .onConflictDoUpdate({ target: schema.siteContent.key, set: { value: value as object, updatedById: actor.userId } });
      await writeAudit(
        actor,
        {
          action: "content.update",
          entityType: "content",
          entityId: key,
          summary: `${actor.label} changed ${CONTENT[key].group} › ${CONTENT[key].label}: “${preview(before)}” → “${preview(value)}”`,
          before: { value: before },
          after: { value },
        },
        tx,
      );
    }
  });
  return { saved: valid.length };
}

async function getContentFresh(keys: ContentKey[]): Promise<Record<string, unknown>> {
  const rows = await db.select().from(schema.siteContent).where(inArray(schema.siteContent.key, keys));
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = CONTENT[k].default;
  for (const r of rows) out[r.key] = r.value;
  return out;
}
