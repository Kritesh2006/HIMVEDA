"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProductInput } from "@/server/catalog/input";
import { CURRENCIES, formatMoney, toMinor } from "@/lib/currency/config";
import { convertFromNpr } from "@/server/currency/pricing";
import { slugify } from "@/lib/slug";
import { Specimen } from "@/components/specimen/Specimen";
import {
  archiveAction,
  createProductAction,
  discardDraftAction,
  publishAction,
  saveDraftAction,
  unpublishAction,
  uploadMediaAction,
  type ActionResult,
} from "@/app/studio/actions";
import { useToast } from "./ui";
import st from "./studio.module.css";
import pe from "./editor.module.css";

type Variant = ProductInput["variants"][number] & { _k: string };
type Form = Omit<ProductInput, "variants"> & { variants: Variant[] };

interface Option {
  id: string;
  label: string;
}
interface Props {
  product: { id: string; status: string; hasDraft: boolean; isDemo: boolean; slug: string } | null;
  initial: ProductInput | null;
  categories: Option[];
  farmers: Option[];
  centers: Option[];
  batches: Option[];
  media: { id: string; alt: string; mimeType: string }[];
  rates: Record<string, number>;
}

const VISUALS = [
  ["pod", "Pod"],
  ["seed", "Seed"],
  ["leaf", "Leaf"],
  ["grain", "Grain"],
  ["root", "Root"],
  ["berry", "Berry"],
  ["flower", "Flower"],
  ["honey", "Comb"],
] as const;

let keySeq = 0;
const k = () => `v${++keySeq}`;

function blank(): Form {
  return {
    name: "",
    slug: "",
    categoryId: null,
    shortDescription: "",
    description: "",
    unit: "pack",
    originCountry: "Nepal",
    district: null,
    producerId: null,
    collectionCenterId: null,
    primaryBatchId: null,
    harvestDate: null,
    qualityGrade: "ungraded",
    verificationStatus: "unverified",
    processingInfo: null,
    visual: "leaf",
    featured: false,
    mediaIds: [],
    variants: [{ _k: k(), label: "", sku: "", weightGrams: null, basePriceNpr: "" as unknown as number, stock: 0, isDefault: true, active: true, regionalPrices: [] }],
  };
}

export function ProductEditor({ product, initial, categories, farmers, centers, batches, media, rates }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<Form>(() =>
    initial ? { ...initial, variants: (initial.variants ?? []).map((v) => ({ ...v, _k: k() })) } : blank(),
  );
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [showOrigin, setShowOrigin] = useState(Boolean(initial?.district || initial?.producerId || initial?.primaryBatchId));
  const [library, setLibrary] = useState(media);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "name" && !slugTouched) next.slug = slugify(String(value));
      return next;
    });
    setDirty(true);
  };
  const setVariant = (i: number, patch: Partial<Variant>) => {
    setForm((f) => ({ ...f, variants: f.variants.map((v, j) => (j === i ? { ...v, ...patch } : patch.isDefault ? { ...v, isDefault: false } : v)) }));
    setDirty(true);
  };

  const payload = () => ({
    ...form,
    variants: form.variants.map(({ _k, ...v }) => ({
      ...v,
      sku: v.sku || `${form.slug || "item"}-${slugify(v.label || "std")}`.toUpperCase().slice(0, 40),
    })),
  });

  const err = (path: string) => errors[path];
  const handle = (r: ActionResult<unknown>, after?: () => void) => {
    if (r.ok) {
      setErrors({});
      setDirty(false);
      if (r.message) toast(r.message);
      after?.();
      router.refresh();
    } else {
      setErrors(r.fields ?? {});
      toast(r.error, "error");
    }
  };

  const doCreate = () =>
    start(async () => {
      const r = await createProductAction(payload());
      handle(r, () => r.ok && r.data && router.push(`/studio/products/${(r.data as { id: string }).id}`));
    });
  const doSave = () => product && start(async () => handle(await saveDraftAction(product.id, payload())));
  const doPublish = () =>
    product &&
    start(async () => {
      if (!window.confirm(product.status === "published" ? "Publish these changes to the live site?" : "Publish this product to the market?")) return;
      handle(await publishAction(product.id, payload()));
    });
  const doUnpublish = () => product && window.confirm("Take this product off the market?") && start(async () => handle(await unpublishAction(product.id)));
  const doDiscard = () =>
    product &&
    window.confirm("Discard the unpublished changes? The live product stays as it is.") &&
    start(async () => handle(await discardDraftAction(product.id), () => window.location.reload()));
  const doArchive = () => product && window.confirm("Archive this product? It will leave the market and the products list.") && start(async () => handle(await archiveAction(product.id), () => router.push("/studio/products")));

  const upload = (file: File) =>
    start(async () => {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("alt", form.name);
      const r = await uploadMediaAction(fd);
      if (r.ok && r.data) {
        const id = r.data as string;
        setLibrary((l) => [{ id, alt: form.name, mimeType: file.type }, ...l]);
        set("mediaIds", [...(form.mediaIds ?? []), id]);
        toast("Image uploaded");
      } else if (!r.ok) toast(r.error, "error");
    });

  const previewRates = useMemo(() => ["USD", "GBP", "EUR", "INR"].filter((c) => rates[c]), [rates]);
  const status = !product ? "New" : product.status === "published" ? (product.hasDraft || dirty ? "Published · changes not live" : "Published") : product.status === "archived" ? "Archived" : "Draft";

  return (
    <div className={pe.editor}>
      <div className={pe.main}>
        {/* Basics */}
        <section className={st.panel} aria-labelledby="basics">
          <div className={st.panelHead}>
            <h2 id="basics">Basics</h2>
            <p>Only the name and one priced size are required.</p>
          </div>
          <div className={st.form}>
            <label className="field">
              <span>Product name</span>
              <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={Boolean(err("name"))} placeholder="e.g. Large Cardamom" />
              {err("name") ? <span className="error-text">{err("name")}</span> : null}
            </label>
            <div className={st.formGrid}>
              <label className="field">
                <span>URL</span>
                <div className={pe.slug}>
                  <span>/products/</span>
                  <input
                    className="input"
                    value={form.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      set("slug", slugify(e.target.value));
                    }}
                    aria-invalid={Boolean(err("slug"))}
                  />
                </div>
                {err("slug") ? <span className="error-text">{err("slug")}</span> : null}
              </label>
              <label className="field">
                <span>Category</span>
                <select className="select" value={form.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value || null)}>
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Sold as</span>
                <input className="input" value={form.unit ?? ""} onChange={(e) => set("unit", e.target.value)} placeholder="pouch, tin, bag…" />
              </label>
            </div>
            <label className="field">
              <span>Short description</span>
              <input className="input" value={form.shortDescription ?? ""} onChange={(e) => set("shortDescription", e.target.value)} maxLength={240} />
              <span className="hint">One sentence for product cards and search results. {(form.shortDescription ?? "").length}/240</span>
            </label>
            <label className="field">
              <span>Full description</span>
              <textarea className="textarea" rows={6} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
              <span className="hint">Describe the product factually. Avoid health or medical claims unless you hold evidence for them.</span>
            </label>
          </div>
        </section>

        {/* Sizes & prices */}
        <section className={st.panel} aria-labelledby="prices">
          <div className={st.panelHead}>
            <h2 id="prices">Sizes & prices</h2>
            <p>Base price in NPR. Other currencies convert automatically unless you set a regional price.</p>
          </div>
          <div className={pe.variants}>
            {form.variants.map((v, i) => {
              const npr = Number(v.basePriceNpr);
              return (
                <fieldset key={v._k} className={pe.variant}>
                  <legend className="sr-only">Size {i + 1}</legend>
                  <div className={pe.variantGrid}>
                    <label className="field">
                      <span>Size label</span>
                      <input className="input" value={v.label} onChange={(e) => setVariant(i, { label: e.target.value })} placeholder="250 g" aria-invalid={Boolean(err(`variants.${i}.label`))} />
                    </label>
                    <label className="field">
                      <span>Base price (NPR)</span>
                      <input
                        className="input"
                        inputMode="decimal"
                        value={v.basePriceNpr === undefined || Number.isNaN(v.basePriceNpr) ? "" : String(v.basePriceNpr)}
                        onChange={(e) => setVariant(i, { basePriceNpr: e.target.value.replace(/[^\d.]/g, "") as unknown as number })}
                        aria-invalid={Boolean(err(`variants.${i}.basePriceNpr`))}
                        placeholder="1500"
                      />
                    </label>
                    <label className="field">
                      <span>In stock</span>
                      <input className="input" inputMode="numeric" value={String(v.stock ?? 0)} onChange={(e) => setVariant(i, { stock: Number(e.target.value.replace(/\D/g, "") || 0) })} />
                    </label>
                    <label className="field">
                      <span>Weight (g)</span>
                      <input className="input" inputMode="numeric" value={v.weightGrams ? String(v.weightGrams) : ""} onChange={(e) => setVariant(i, { weightGrams: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null })} />
                    </label>
                    <label className="field">
                      <span>SKU</span>
                      <input className="input" value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value.toUpperCase() })} placeholder="auto" aria-invalid={Boolean(err(`variants.${i}.sku`))} />
                    </label>
                  </div>
                  {[`variants.${i}.label`, `variants.${i}.basePriceNpr`, `variants.${i}.sku`].map((p) => (err(p) ? <span key={p} className="error-text">{err(p)}</span> : null))}

                  {npr > 0 ? (
                    <p className={pe.preview}>
                      <strong>{formatMoney(toMinor(npr, "NPR"), "NPR")}</strong>
                      {previewRates.map((c) => {
                        const override = v.regionalPrices?.find((r) => r.currency === c);
                        return (
                          <span key={c} data-override={override ? "" : undefined}>
                            {override ? formatMoney(toMinor(Number(override.amount), c), c) : formatMoney(convertFromNpr(toMinor(npr, "NPR"), c as "USD", rates[c]!), c, { approx: true })}
                          </span>
                        );
                      })}
                    </p>
                  ) : null}

                  <details className={pe.regional} open={Boolean(v.regionalPrices?.length)}>
                    <summary>Regional prices{v.regionalPrices?.length ? ` (${v.regionalPrices.length})` : ""}</summary>
                    <div className={pe.regionalList}>
                      {(v.regionalPrices ?? []).map((r, j) => (
                        <div key={j} className={st.inline}>
                          <select
                            className="select"
                            value={r.currency}
                            onChange={(e) => setVariant(i, { regionalPrices: v.regionalPrices!.map((x, y) => (y === j ? { ...x, currency: e.target.value } : x)) })}
                            aria-label="Currency"
                          >
                            {CURRENCIES.filter((c) => c.code !== "NPR").map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.code}
                              </option>
                            ))}
                          </select>
                          <input
                            className="input"
                            inputMode="decimal"
                            value={String(r.amount ?? "")}
                            onChange={(e) => setVariant(i, { regionalPrices: v.regionalPrices!.map((x, y) => (y === j ? { ...x, amount: e.target.value.replace(/[^\d.]/g, "") as unknown as number } : x)) })}
                            aria-label="Amount"
                            style={{ width: 120 }}
                          />
                          <button type="button" className="btn btn-ghost btn-small" onClick={() => setVariant(i, { regionalPrices: v.regionalPrices!.filter((_, y) => y !== j) })}>
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn btn-ghost btn-small"
                        onClick={() => {
                          const used = new Set(v.regionalPrices?.map((r) => r.currency));
                          const next = CURRENCIES.find((c) => c.code !== "NPR" && !used.has(c.code));
                          if (next) setVariant(i, { regionalPrices: [...(v.regionalPrices ?? []), { currency: next.code, amount: "" as unknown as number }] });
                        }}
                      >
                        + Set a price for another currency
                      </button>
                      <p className="hint">A regional price replaces the automatic conversion for that currency only.</p>
                    </div>
                  </details>

                  <div className={pe.variantFoot}>
                    <label className={st.check}>
                      <input type="radio" name="default-variant" checked={Boolean(v.isDefault)} onChange={() => setVariant(i, { isDefault: true })} />
                      Shown first
                    </label>
                    <label className={st.check}>
                      <input type="checkbox" checked={v.active !== false} onChange={(e) => setVariant(i, { active: e.target.checked })} />
                      Available
                    </label>
                    {form.variants.length > 1 ? (
                      <button type="button" className="btn btn-ghost btn-small" onClick={() => set("variants", form.variants.filter((_, j) => j !== i))}>
                        Remove size
                      </button>
                    ) : null}
                  </div>
                </fieldset>
              );
            })}
            {err("variants") ? <span className="error-text">{err("variants")}</span> : null}
            <button
              type="button"
              className="btn btn-ghost btn-small"
              style={{ justifySelf: "start" }}
              onClick={() => set("variants", [...form.variants, { _k: k(), label: "", sku: "", weightGrams: null, basePriceNpr: "" as unknown as number, stock: 0, isDefault: false, active: true, regionalPrices: [] }])}
            >
              + Add another size
            </button>
          </div>
        </section>

        {/* Images */}
        <section className={st.panel} aria-labelledby="images">
          <div className={st.panelHead}>
            <h2 id="images">Images</h2>
            <p>Use real photographs of the product. Without photos, the product shows its illustration.</p>
          </div>
          <div className={pe.images}>
            {(form.mediaIds ?? []).map((id, i) => (
              <figure key={id} className={pe.image}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/media/${id}`} alt="" />
                <div className={pe.imageTools}>
                  {i > 0 ? (
                    <button type="button" onClick={() => set("mediaIds", [id, ...(form.mediaIds ?? []).filter((x) => x !== id)])}>
                      Make first
                    </button>
                  ) : (
                    <span>Cover</span>
                  )}
                  <button type="button" onClick={() => set("mediaIds", (form.mediaIds ?? []).filter((x) => x !== id))}>
                    Remove
                  </button>
                </div>
              </figure>
            ))}
            <div className={pe.addImage}>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              <button type="button" className="btn btn-ghost btn-small" onClick={() => fileRef.current?.click()} disabled={pending}>
                Upload photo
              </button>
              {library.filter((m) => m.mimeType.startsWith("image/") && !(form.mediaIds ?? []).includes(m.id)).length ? (
                <select
                  className="select"
                  value=""
                  onChange={(e) => e.target.value && set("mediaIds", [...(form.mediaIds ?? []), e.target.value])}
                  aria-label="Add from media library"
                >
                  <option value="">Add from library…</option>
                  {library
                    .filter((m) => m.mimeType.startsWith("image/") && !(form.mediaIds ?? []).includes(m.id))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.alt || m.id.slice(0, 8)}
                      </option>
                    ))}
                </select>
              ) : null}
            </div>
          </div>
        </section>

        {/* Origin & traceability */}
        <section className={st.panel} aria-labelledby="origin">
          <div className={st.panelHead}>
            <h2 id="origin">Origin & traceability</h2>
            {!showOrigin ? (
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setShowOrigin(true)}>
                Add origin details
              </button>
            ) : (
              <p>Optional. Only add what you can stand behind.</p>
            )}
          </div>
          {showOrigin ? (
            <div className={st.formGrid}>
              <label className="field">
                <span>Country of origin</span>
                <input className="input" value={form.originCountry ?? ""} onChange={(e) => set("originCountry", e.target.value)} />
              </label>
              <label className="field">
                <span>District</span>
                <input className="input" value={form.district ?? ""} onChange={(e) => set("district", e.target.value)} />
              </label>
              <label className="field">
                <span>Producer</span>
                <select className="select" value={form.producerId ?? ""} onChange={(e) => set("producerId", e.target.value || null)}>
                  <option value="">Not specified</option>
                  {farmers.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <span className="hint">Shown publicly only if the producer agreed to it.</span>
              </label>
              <label className="field">
                <span>Collection centre</span>
                <select className="select" value={form.collectionCenterId ?? ""} onChange={(e) => set("collectionCenterId", e.target.value || null)}>
                  <option value="">Not specified</option>
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Batch</span>
                <select className="select" value={form.primaryBatchId ?? ""} onChange={(e) => set("primaryBatchId", e.target.value || null)}>
                  <option value="">No batch linked</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Harvest date</span>
                <input className="input" type="date" value={form.harvestDate ?? ""} onChange={(e) => set("harvestDate", e.target.value || null)} />
              </label>
              <label className="field">
                <span>Quality grade</span>
                <select className="select" value={form.qualityGrade} onChange={(e) => set("qualityGrade", e.target.value as Form["qualityGrade"])}>
                  <option value="ungraded">Not graded</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              </label>
              <label className="field">
                <span>Verification</span>
                <select className="select" value={form.verificationStatus} onChange={(e) => set("verificationStatus", e.target.value as Form["verificationStatus"])}>
                  <option value="unverified">Not yet verified</option>
                  <option value="pending">Verification in progress</option>
                  <option value="verified">Verified at collection</option>
                </select>
              </label>
              <label className="field" style={{ gridColumn: "1 / -1" }}>
                <span>Processing</span>
                <input className="input" value={form.processingInfo ?? ""} onChange={(e) => set("processingInfo", e.target.value)} placeholder="Sun-dried → cleaned → packed" />
              </label>
            </div>
          ) : null}
        </section>
      </div>

      {/* Side column */}
      <aside className={pe.side}>
        <section className={st.panel}>
          <div className={st.panelHead}>
            <h2>Status</h2>
            <span className={st.status} data-tone={product?.status === "published" && !product.hasDraft && !dirty ? "ok" : "warn"}>
              {status}
            </span>
          </div>
          {product?.isDemo ? <p className="small" style={{ marginBottom: 12 }}><span className="tag tag-sample">Sample</span> This is demonstration data.</p> : null}
          <div className={pe.actions}>
            {!product ? (
              <button type="button" className="btn btn-block" onClick={doCreate} disabled={pending}>
                {pending ? "Saving…" : "Save draft"}
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-ghost btn-block" onClick={doSave} disabled={pending}>
                  {pending ? "Saving…" : "Save draft"}
                </button>
                <Link
                  href={`/products/${product.slug}?preview=1`}
                  target="_blank"
                  className="btn btn-ghost btn-block"
                  aria-disabled={dirty}
                  title={dirty ? "Save a draft first to preview it" : undefined}
                >
                  Preview
                </Link>
                <button type="button" className="btn btn-block" onClick={doPublish} disabled={pending}>
                  {product.status === "published" ? "Publish changes" : "Publish"}
                </button>
                {product.hasDraft ? (
                  <button type="button" className="btn btn-ghost btn-small" onClick={doDiscard} disabled={pending}>
                    Discard unpublished changes
                  </button>
                ) : null}
                {product.status === "published" ? (
                  <button type="button" className="btn btn-ghost btn-small" onClick={doUnpublish} disabled={pending}>
                    Unpublish
                  </button>
                ) : null}
                {product.status !== "archived" ? (
                  <button type="button" className="btn btn-ghost btn-small" onClick={doArchive} disabled={pending}>
                    Archive
                  </button>
                ) : null}
              </>
            )}
          </div>
          <p className="hint" style={{ marginTop: 12 }}>
            {product?.status === "published"
              ? "Save draft keeps edits private. Publish changes updates the live site everywhere at once."
              : "Drafts are never shown to visitors."}
          </p>
        </section>

        <section className={st.panel}>
          <div className={st.panelHead}>
            <h2>Presentation</h2>
          </div>
          <label className={st.check}>
            <input type="checkbox" checked={Boolean(form.featured)} onChange={(e) => set("featured", e.target.checked)} />
            Feature on the homepage
          </label>
          <p className="label" style={{ margin: "14px 0 8px" }}>
            Illustration
          </p>
          <div className={pe.visuals} role="radiogroup" aria-label="Illustration">
            {VISUALS.map(([key, label]) => (
              <label key={key} className={pe.visual} data-on={form.visual === key || undefined}>
                <input type="radio" name="visual" value={key} checked={form.visual === key} onChange={() => set("visual", key)} className="sr-only" />
                <Specimen visual={key} size="thumb" />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
