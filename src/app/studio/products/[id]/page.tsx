import Link from "next/link";
import { notFound } from "next/navigation";
import { loadProductInput } from "@/server/catalog/mutations";
import { ProductEditor } from "@/components/studio/ProductEditor";
import { editorOptions } from "../options";
import { fmtDate } from "@/lib/format";
import st from "@/components/studio/studio.module.css";

export const metadata = { title: "Edit product" };

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [loaded, o] = await Promise.all([loadProductInput(id), editorOptions()]);
  if (!loaded) notFound();
  const p = loaded.product;
  return (
    <>
      <div className={st.pageHead}>
        <div>
          <Link href="/studio/products" className="small">
            Products
          </Link>
          <h1>{p.name}</h1>
          <p>
            {loaded.hasDraft ? `Unpublished changes saved ${fmtDate(p.draftUpdatedAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}. ` : ""}
            Last updated {fmtDate(p.updatedAt, { day: "numeric", month: "short", year: "numeric" })}.
          </p>
        </div>
        <div className={st.pageActions}>
          {p.status === "published" ? (
            <Link href={`/products/${p.slug}`} target="_blank" className="btn btn-ghost btn-small">
              View live page
            </Link>
          ) : null}
          <Link href={`/studio/audit?q=${encodeURIComponent(p.name)}`} className="btn btn-ghost btn-small">
            History
          </Link>
        </div>
      </div>
      <ProductEditor
        key={`${id}-${p.updatedAt.toISOString()}-${loaded.hasDraft}`}
        product={{ id: p.id, status: p.status, hasDraft: loaded.hasDraft, isDemo: p.isDemo, slug: p.slug }}
        initial={loaded.input}
        {...o}
      />
    </>
  );
}
