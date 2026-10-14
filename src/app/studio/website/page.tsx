import { getContent } from "@/server/content/service";
import { CONTENT } from "@/server/content/registry";
import { listMedia } from "@/server/ops/admin";
import { WebsiteEditor, type Entry } from "@/components/studio/WebsiteEditor";
import { EditSiteButton } from "@/components/studio/EditSiteButton";
import st from "@/components/studio/studio.module.css";

export const metadata = { title: "Website" };

export default async function WebsitePage() {
  const [c, media] = await Promise.all([getContent(), listMedia()]);
  const entries: Entry[] = Object.entries(CONTENT)
    .filter(([, d]) => d.group !== "Settings")
    .map(([key, d]) => ({
      key,
      kind: d.kind,
      label: d.label,
      group: d.group,
      help: "help" in d ? d.help : undefined,
      max: "max" in d ? d.max : undefined,
      value: (c as Record<string, unknown>)[key],
    }));
  return (
    <>
      <div className={st.pageHead}>
        <div>
          <h1>Website</h1>
          <p>Every piece of website copy, contact detail and policy text. Or edit text directly on the page with Edit website.</p>
        </div>
        <div className={st.pageActions}>
          <EditSiteButton />
        </div>
      </div>
      <WebsiteEditor entries={entries} images={media.filter((m) => m.mimeType.startsWith("image/")).map((m) => ({ id: m.id, label: m.alt || m.filename }))} />
    </>
  );
}
