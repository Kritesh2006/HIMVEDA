import Link from "next/link";
import type { ProductCard as Card } from "@/server/catalog/queries";
import { Price } from "@/components/currency/Price";
import { Specimen } from "@/components/specimen/Specimen";
import { MediaImage } from "@/components/product/MediaImage";
import styles from "./ProductCard.module.css";

export function ProductCard({ product, showSample, priority = false }: { product: Card; showSample: boolean; priority?: boolean }) {
  const img = product.images[0];
  return (
    <article className={styles.card} data-out={!product.inStock || undefined}>
      <Link href={`/products/${product.slug}`} className={styles.media} aria-label={product.name} tabIndex={-1}>
        {img ? (
          <MediaImage id={img.id} alt={img.alt} className={styles.photo} priority={priority} sizes="(min-width: 1100px) 25vw, (min-width: 640px) 45vw, 90vw" />
        ) : (
          <Specimen visual={product.visual} label={product.category?.nameNe} code={product.batchCode} />
        )}
      </Link>
      <div className={styles.body}>
        <div className={styles.meta}>
          <span>{product.district ? `${product.district}` : product.category?.name}</span>
          {showSample && product.isDemo ? <span className="tag tag-sample">Sample</span> : null}
        </div>
        <h3 className={styles.name}>
          <Link href={`/products/${product.slug}`}>{product.name}</Link>
        </h3>
        <div className={styles.row}>
          {product.fromPrice ? (
            <Price
              minor={product.fromPrice.amountMinor}
              currency={product.fromPrice.currency}
              approx={product.fromPrice.approximate}
              prefix={product.hasRange ? "from" : undefined}
              className={styles.price}
            />
          ) : null}
          <span className={styles.stock} data-state={product.inStock ? "in" : "out"}>
            {product.inStock ? `${product.variantCount} size${product.variantCount > 1 ? "s" : ""}` : "Out of stock"}
          </span>
        </div>
      </div>
    </article>
  );
}
