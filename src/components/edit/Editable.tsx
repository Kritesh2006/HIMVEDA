import Link from "next/link";
import { getContent } from "@/server/content/service";
import { isEditMode } from "@/server/auth/session";
import { CONTENT, type ContentKey } from "@/server/content/registry";
import type { LinkValue } from "@/server/content/registry";

type TextKey = { [K in ContentKey]: (typeof CONTENT)[K]["kind"] extends "text" | "richtext" ? K : never }[ContentKey];
type LinkKey = { [K in ContentKey]: (typeof CONTENT)[K]["kind"] extends "link" ? K : never }[ContentKey];

/**
 * Renders a CMS text value. For visitors it is plain markup. For a signed-in
 * editor with "Edit website" on, the element carries data attributes that the
 * client edit overlay picks up — the value itself is still server-rendered.
 */
export async function Editable({
  k,
  as: Tag = "span",
  className,
  multiline,
}: {
  k: TextKey;
  as?: "h1" | "h2" | "h3" | "p" | "span" | "div";
  className?: string;
  multiline?: boolean;
}) {
  const [c, edit] = await Promise.all([getContent(), isEditMode()]);
  const value = c[k] as string;
  if (!edit) return value ? <Tag className={className}>{value}</Tag> : null;
  const def = CONTENT[k];
  return (
    <Tag
      className={className}
      data-edit-key={k}
      data-edit-kind="text"
      data-edit-label={`${def.group} › ${def.label}`}
      data-edit-max={"max" in def ? def.max : undefined}
      data-edit-multiline={multiline || undefined}
    >
      {value || " "}
    </Tag>
  );
}

export async function EditableLink({ k, className, magnetic }: { k: LinkKey; className?: string; magnetic?: boolean }) {
  const [c, edit] = await Promise.all([getContent(), isEditMode()]);
  const v = c[k] as LinkValue;
  if (!v.label || !v.href) {
    if (!edit) return null;
  }
  const def = CONTENT[k];
  return (
    <Link
      href={v.href || "#"}
      className={className}
      data-magnetic={magnetic || undefined}
      {...(edit
        ? { "data-edit-key": k, "data-edit-kind": "link", "data-edit-label": `${def.group} › ${def.label}`, "data-edit-href": v.href }
        : {})}
    >
      {v.label || "Add link"}
    </Link>
  );
}
