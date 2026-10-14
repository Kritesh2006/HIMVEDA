/** Validates a content value against the registry. Pure — unit tested. */
import { z } from "zod";
import { CONTENT, isContentKey, type ContentKey } from "./registry";

const safeHref = z
  .string()
  .max(500)
  .refine((h) => h === "" || h.startsWith("/") || /^https?:\/\//.test(h) || /^mailto:|^tel:/.test(h), "Links must be relative, http(s), mailto: or tel:");
const linkSchema = z.object({ label: z.string().max(80), href: safeHref });

const jsonSchemas: Partial<Record<ContentKey, z.ZodTypeAny>> = {
  "nav.items": z.array(linkSchema).max(8),
  "social.links": z.array(z.object({ network: z.string().min(1).max(40), href: safeHref })).max(10),
  "faq.items": z.array(z.object({ q: z.string().min(1).max(200), a: z.string().min(1).max(2000) })).max(40),
  "home.audiences.items": z
    .array(z.object({ who: z.string().min(1).max(80), line: z.string().max(240), cta: linkSchema }))
    .max(6),
  "home.chain.steps": z
    .array(
      z.object({
        key: z.string().max(20),
        name: z.string().min(1).max(40),
        nameNe: z.string().max(40),
        title: z.string().min(1).max(120),
        body: z.string().max(600),
        recorded: z.array(z.string().max(60)).max(6),
      }),
    )
    .length(5),
};

export function validateContent(key: string, value: unknown): { ok: true; key: ContentKey; value: unknown } | { ok: false; error: string } {
  if (!isContentKey(key)) return { ok: false, error: `Unknown content key: ${key}` };
  const def = CONTENT[key];
  let parsed: z.SafeParseReturnType<unknown, unknown>;
  switch (def.kind) {
    case "text":
    case "richtext":
      parsed = z
        .string()
        .max("max" in def && def.max ? def.max : 20000)
        .transform((s) => (def.kind === "text" ? s.replace(/\s+/g, " ").trim() : s))
        .safeParse(value);
      break;
    case "boolean":
      parsed = z.boolean().safeParse(value);
      break;
    case "link":
      parsed = linkSchema.safeParse(value);
      break;
    case "image":
      parsed = z.string().uuid().nullable().safeParse(value);
      break;
    case "json":
      parsed = (jsonSchemas[key] ?? z.unknown()).safeParse(value);
      break;
  }
  if (!parsed.success) return { ok: false, error: `${def.label}: ${parsed.error.issues[0]?.message ?? "invalid"}` };
  return { ok: true, key, value: parsed.data };
}

