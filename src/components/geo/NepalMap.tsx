import { CONTOURS, MAP_H, MAP_W, NEPAL_OUTLINE, project, routePath } from "@/lib/geo";
import styles from "./NepalMap.module.css";

export interface MapNode {
  lat: number;
  lng: number;
  label?: string;
  sub?: string;
  kind: "origin" | "center" | "hub" | "market";
  active?: boolean;
  /** label placement */
  align?: "left" | "right" | "above" | "below";
  /** numbered sequence marker (replaces the text label; pair with a legend) */
  marker?: string;
}

interface Props {
  nodes?: MapNode[];
  /** ordered points the trace path passes through */
  route?: { lat: number; lng: number }[];
  /** draw the route when the map scrolls into view (or immediately with "load") */
  draw?: "load" | "view" | "static";
  className?: string;
  title: string;
  description?: string;
  tone?: "light" | "forest";
  contourDensity?: "full" | "light";
  /** zoom the view to the route and nodes instead of showing all of Nepal */
  fit?: boolean;
  /** multiplier for labels and markers when the map renders small */
  labelScale?: number;
}

/**
 * Nepal, drawn from Natural Earth geometry with illustrative terrain contours.
 * Server component: ships as static SVG. Animation is CSS-only (stroke drawing),
 * triggered by the global in-view observer via [data-inview].
 */
export function NepalMap({ nodes = [], route, draw = "view", className, title, description, tone = "light", contourDensity = "full", fit = false, labelScale = 1 }: Props) {
  const clipId = `np-clip-${tone}${fit ? "-fit" : ""}`;
  const pts = route?.map((p) => project(p.lat, p.lng)) ?? [];

  // Viewport: whole country, or a window around the route (keeps the country's aspect ratio).
  let vb = { x: -20, y: -20, w: MAP_W + 40, h: MAP_H + 40 };
  if (fit) {
    const all = [...pts, ...nodes.map((n) => project(n.lat, n.lng))];
    if (all.length) {
      const xs = all.map((p) => p[0]);
      const ys = all.map((p) => p[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const aspect = (MAP_W + 40) / (MAP_H + 40);
      let w = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * aspect) * 1.7;
      w = Math.min(MAP_W + 40, Math.max(w, 180));
      const h = w / aspect;
      vb = {
        x: Math.round(Math.min(Math.max(cx - w / 2, -20), MAP_W + 20 - w)),
        y: Math.round(Math.min(Math.max(cy - h / 2, -20), MAP_H + 20 - h)),
        w: Math.round(w),
        h: Math.round(h),
      };
    }
  }
  const z = (vb.w / (MAP_W + 40)) * labelScale;
  const d = routePath(pts);
  const contours = contourDensity === "full" ? CONTOURS : CONTOURS.filter((_, i) => i % 2 === 1);

  return (
    <figure
      className={`${styles.map} ${className ?? ""}`}
      data-tone={tone}
      data-draw={draw}
      data-fit={fit || undefined}
      data-inview={draw === "view" ? "" : undefined}
      style={{ ["--z" as string]: z }}
    >
      <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} role="img" aria-labelledby={`${clipId}-t`}>
        <title id={`${clipId}-t`}>{title}</title>
        {description ? <desc>{description}</desc> : null}
        <defs>
          <clipPath id={clipId}>
            <path d={NEPAL_OUTLINE} />
          </clipPath>
        </defs>
        <path d={NEPAL_OUTLINE} className={styles.land} />
        <g clipPath={`url(#${clipId})`} className={styles.contours}>
          {contours.map((c, i) => (
            <path key={c.level} d={c.d} style={{ ["--i" as string]: i }} />
          ))}
        </g>
        <path d={NEPAL_OUTLINE} className={styles.border} />

        {d ? (
          <>
            <path d={d} className={styles.routeShadow} />
            <path d={d} className={styles.route} pathLength={1} />
          </>
        ) : null}

        {nodes.map((n, i) => {
          let [x, y] = project(n.lat, n.lng);
          if (n.marker) {
            // nudge markers that would overlap an earlier one
            for (const prev of nodes.slice(0, i)) {
              const [px, py] = project(prev.lat, prev.lng);
              if (Math.hypot(px - x, py - y) < 22 * z) {
                x += 18 * z;
                y += 14 * z;
              }
            }
          }
          const align = n.align ?? (x > MAP_W * 0.8 ? "left" : "right");
          const tx = align === "left" ? x - 14 * z : align === "right" ? x + 14 * z : x;
          const ty = align === "above" ? y - 16 * z : align === "below" ? y + 26 * z : y + 5 * z;
          const anchor = align === "left" ? "end" : align === "right" ? "start" : "middle";
          return (
            <g key={`${n.lat}-${n.lng}-${i}`} className={styles.node} data-kind={n.kind} data-active={n.active || undefined} style={{ ["--n" as string]: i }}>
              {n.kind === "origin" ? <circle cx={x} cy={y} r={16 * z} className={styles.halo} /> : null}
              {n.marker ? (
                <>
                  <circle cx={x} cy={y} r={10 * z} className={styles.markerDot} />
                  <text x={x} y={y + 4.2 * z} textAnchor="middle" className={styles.markerText}>
                    {n.marker}
                  </text>
                </>
              ) : (
                <circle cx={x} cy={y} r={(n.kind === "center" ? 5 : 6.5) * z} className={styles.dot} />
              )}
              {n.label && !n.marker ? (
                <text x={tx} y={ty} textAnchor={anchor} className={styles.label}>
                  {n.label}
                  {n.sub ? (
                    <tspan x={tx} dy={17 * z} className={styles.sub}>
                      {n.sub}
                    </tspan>
                  ) : null}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
