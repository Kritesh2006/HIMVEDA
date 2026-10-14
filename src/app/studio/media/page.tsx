import { listMedia } from "@/server/ops/admin";
import { DeleteMedia, MediaAlt, UploadForm } from "@/components/studio/forms";
import { fmtDate } from "@/lib/format";
import st from "@/components/studio/studio.module.css";

export const metadata = { title: "Media" };

export default async function MediaPage() {
  const media = await listMedia();
  return (
    <>
      <div className={st.pageHead}>
        <div>
          <h1>Media</h1>
          <p>Photographs and documents. JPEG, PNG, WebP, AVIF or PDF, up to 4 MB. Use real photographs of HIMVEDA products, people and places, with permission.</p>
        </div>
      </div>
      <section className={st.panel}>
        <UploadForm />
      </section>
      <section className={st.panel}>
        {media.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
            {media.map((m) => (
              <figure key={m.id} style={{ margin: 0, display: "grid", gap: 8 }}>
                {m.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/media/${m.id}`} alt={m.alt} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 6, background: "var(--paper-2)" }} loading="lazy" />
                ) : (
                  <a href={`/api/media/${m.id}`} target="_blank" rel="noopener" style={{ aspectRatio: "4/3", display: "grid", placeItems: "center", borderRadius: 6, background: "var(--paper-2)", textDecoration: "none" }}>
                    PDF document
                  </a>
                )}
                <figcaption className="small">
                  <div className={st.muted}>
                    {m.filename} · {Math.round(m.byteSize / 1024)} KB{m.width ? ` · ${m.width}×${m.height}` : ""} · {fmtDate(m.createdAt)}
                  </div>
                  <MediaAlt id={m.id} alt={m.alt} />
                  <DeleteMedia id={m.id} />
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className={st.empty}>Nothing uploaded yet. Products show their illustration until a photograph is added.</p>
        )}
      </section>
    </>
  );
}
