/* eslint-disable @next/next/no-img-element */
/**
 * Images uploaded through Studio are served by /api/media/[id] with long-lived
 * caching. Plain <img> keeps it dependency-free; width/height are set by CSS.
 */
export function MediaImage({ id, alt, className, priority, sizes }: { id: string; alt: string; className?: string; priority?: boolean; sizes?: string }) {
  return (
    <img
      src={`/api/media/${id}`}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      sizes={sizes}
      fetchPriority={priority ? "high" : undefined}
    />
  );
}
