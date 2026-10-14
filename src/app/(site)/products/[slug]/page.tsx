import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductPreview, getPublishedProduct, getRelatedProducts } from "@/server/catalog/queries";
import { getEditorSession } from "@/server/auth/session";
import { getCurrencyContext, isDevRates } from "@/server/currency/service";
import { getContent } from "@/server/content/service";
import { Specimen } from "@/components/specimen/Specimen";
import { MediaImage } from "@/components/product/MediaImage";
import { ProductCard } from "@/components/product/ProductCard";
import { BuyBox } from "@/components/product/BuyBox";
import { fmtDate } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";
import s from "@/components/product/product.module.css";

type Params = Promise<{ slug: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPublishedProduct(slug);
  if (!p) return { title: "Product not found", robots: { index: false } };
  return {
    title: p.name,
    description: p.shortDescription || `${p.name} from ${p.district ?? "Nepal"}, traced by batch.`,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: { title: `${p.name} — HIMVEDA`, description: p.shortDescription, url: absoluteUrl(`/products/${p.slug}`), type: "website" },
  };
}

const VERIFY: Record<string, string> = { verified: "Verified at collection", pending: "Verification in progress", unverified: "Not yet verified" };

export default async function ProductPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { slug } = await params;
  const sp = await searchParams;
  const wantsPreview = sp.preview === "1";
  const session = wantsPreview ? await getEditorSession() : null;
  const product = session ? await getProductPreview(slug) : await getPublishedProduct(slug);
  if (!product) notFound();
  const [related, ctx, c] = await Promise.all([getRelatedProducts(product), getCurrencyContext(), getContent()]);
  const demo = c["settings.demoMode"];

  const facts = [
    ["Origin", [product.district, product.originCountry].filter(Boolean).join(", ")],
    ["Collection centre", product.collectionCenter ? `${product.collectionCenter.name} (${product.collectionCenter.code})` : null],
    ["Producer", product.producerName],
    ["Harvest", product.harvestDate ? fmtDate(product.harvestDate, { month: "long", year: "numeric" }) : null],
    ["Quality grade", product.qualityGrade !== "ungraded" ? `Grade ${product.qualityGrade}` : null],
    ["Verification", VERIFY[product.verificationStatus]],
    ["Processing", product.processingInfo],
    ["Sold as", product.unit],
  ].filter(([, v]) => v) as [string, string][];

  const jsonLd = product.isPreview
    ? null
    : {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.shortDescription || product.description,
        sku: product.variants[0]?.sku,
        brand: { "@type": "Brand", name: "HIMVEDA" },
        countryOfOrigin: product.originCountry,
        url: absoluteUrl(`/products/${product.slug}`),
        offers: product.variants.map((v) => ({
          "@type": "Offer",
          sku: v.sku,
          name: v.label,
          price: (v.price.baseMinor / 100).toFixed(2),
          priceCurrency: "NPR",
          availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          url: absoluteUrl(`/products/${product.slug}`),
        })),
      };

  return (
    <>
      {product.isPreview ? (
        <div className={s.previewBar} role="status">
          <div className="wrap">
            <strong>Preview.</strong> {product.hasDraft ? "Showing unpublished changes." : product.status === "published" ? "No pending changes." : "This product is not published."}{" "}
            Visitors don’t see this banner.
          </div>
        </div>
      ) : null}
      <article className={`wrap ${s.page}`}>
        <nav aria-label="Breadcrumb" className={s.crumbs}>
          <ol role="list">
            <li>
              <Link href="/market">Market</Link>
            </li>
            {product.category ? (
              <li>
                <Link href={`/market?category=${product.category.slug}`}>{product.category.name}</Link>
              </li>
            ) : null}
            <li aria-current="page">{product.name}</li>
          </ol>
        </nav>

        <div className={s.layout}>
          <div className={s.gallery}>
            {product.images.length ? (
              <div className={s.photos}>
                {product.images.map((img, i) => (
                  <MediaImage key={img.id} id={img.id} alt={img.alt} className={s.photo} priority={i === 0} />
                ))}
              </div>
            ) : (
              <Specimen visual={product.visual} label={product.category?.nameNe} code={product.batchCode} size="hero" />
            )}
          </div>

          <div className={s.info}>
            <p className={s.meta}>
              {product.category?.name}
              {product.district ? <> · {product.district}</> : null}
              {demo && product.isDemo ? <span className="tag tag-sample">Sample listing</span> : null}
            </p>
            <h1 className="h1">{product.name}</h1>
            {product.shortDescription ? <p className="lede">{product.shortDescription}</p> : null}

            <BuyBox variants={product.variants} disabled={product.isPreview} devRates={isDevRates(ctx)} />

            {product.batch?.isPublic ? (
              <Link href={`/trace/${product.batch.code}`} className={s.traceLink}>
                <span className={s.traceDot} aria-hidden="true" />
                <span>
                  <span className={s.traceLabel}>This stock comes from batch</span>
                  <span className="code">{product.batch.code}</span>
                </span>
                <span className={s.traceCta}>See its journey</span>
              </Link>
            ) : null}

            <dl className={s.facts}>
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {product.description ? (
          <section className={s.description} aria-labelledby="about-title">
            <h2 id="about-title" className="h3">
              About this product
            </h2>
            <div className="body-serif">
              {product.description.split(/\n{2,}/).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>
        ) : null}

        {related.length ? (
          <section className={s.related} aria-labelledby="related-title">
            <h2 id="related-title" className="h2">
              Also from the market
            </h2>
            <ul role="list" className={s.relatedGrid}>
              {related.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} showSample={demo} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} /> : null}
    </>
  );
}
