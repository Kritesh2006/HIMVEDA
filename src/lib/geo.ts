import geo from "@/generated/nepal-geo.json";

export const MAP_W = geo.width;
export const MAP_H = geo.height;
export const NEPAL_OUTLINE = geo.outline;
export const CONTOURS = geo.contours as { level: number; d: string }[];

/** Same equirectangular projection used to build the outline. */
export function project(lat: number, lng: number): [number, number] {
  const { lonMin, latMax, k, scale } = geo.projection;
  return [Math.round((lng - lonMin) * k * scale * 10) / 10, Math.round((latMax - lat) * scale * 10) / 10];
}

/** A gently arched path through points — reads as movement, not a straight database line. */
export function routePath(points: [number, number][], arch = 0.18): string {
  if (points.length < 2) return "";
  let d = `M${points[0]![0]} ${points[0]![1]}`;
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1]!;
    const [x2, y2] = points[i]!;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const cx = mx - dy * arch;
    const cy = my + dx * arch * -1;
    d += ` Q${Math.round(cx * 10) / 10} ${Math.round(cy * 10) / 10} ${x2} ${y2}`;
  }
  return d;
}
