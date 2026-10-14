/**
 * Builds src/generated/nepal-geo.json:
 *  - Nepal's outline (Natural Earth via world-atlas 10m), projected to a 1000-wide viewBox
 *  - Illustrative terrain contours: a stylised elevation model that follows Nepal's real
 *    physiography (Terai → Siwalik → Mahabharat → mid-hills → Himalaya, south → north),
 *    perturbed with seeded noise. It is an artwork, not survey data.
 *
 *   npm run geo:build
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Polygon, MultiPolygon } from "geojson";

const topo = JSON.parse(readFileSync("node_modules/world-atlas/countries-10m.json", "utf8")) as Topology;
const fc = feature(topo, topo.objects.countries as GeometryCollection) as unknown as { features: Feature<Polygon | MultiPolygon, { name: string }>[] };
const nepal = fc.features.find((f) => f.properties.name === "Nepal");
if (!nepal) throw new Error("Nepal not found");
const rings: number[][][] =
  nepal.geometry.type === "Polygon" ? [nepal.geometry.coordinates[0]!] : nepal.geometry.coordinates.map((p) => p[0]!);
const ring = rings.sort((a, b) => b.length - a.length)[0]!;

const lons = ring.map((p) => p[0]!);
const lats = ring.map((p) => p[1]!);
const PAD = 0.12;
const lonMin = Math.min(...lons) - PAD;
const lonMax = Math.max(...lons) + PAD;
const latMin = Math.min(...lats) - PAD;
const latMax = Math.max(...lats) + PAD;
const K = Math.cos(((latMin + latMax) / 2) * (Math.PI / 180));
const W = 1000;
const scale = W / ((lonMax - lonMin) * K);
const H = Math.round((latMax - latMin) * scale);
const project = (lon: number, lat: number): [number, number] => [(lon - lonMin) * K * scale, (latMax - lat) * scale];

const r1 = (n: number) => Math.round(n * 10) / 10;
const outline = ring.map(([lon, lat], i) => {
  const [x, y] = project(lon!, lat!);
  return `${i ? "L" : "M"}${r1(x)} ${r1(y)}`;
});
const outlinePath = outline.join("") + "Z";

// ---------- southern / northern border lookup per x ----------
const pts = ring.map(([lon, lat]) => project(lon!, lat!));
function borderAt(x: number): { s: number; n: number } | null {
  const ys: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i]!;
    const [x2, y2] = pts[i + 1]!;
    if ((x1 <= x && x2 > x) || (x2 <= x && x1 > x)) ys.push(y1 + ((x - x1) / (x2 - x1)) * (y2 - y1));
  }
  if (ys.length < 2) return null;
  return { n: Math.min(...ys), s: Math.max(...ys) };
}

// ---------- seeded value noise ----------
let seed = 2026;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const G = 64;
const lattice = Array.from({ length: G * G }, rand);
const smooth = (t: number) => t * t * (3 - 2 * t);
function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const v = (i: number, j: number) => lattice[((((j % G) + G) % G) * G + (((i % G) + G) % G))]!;
  const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
const fbm = (x: number, y: number) => {
  let s = 0, amp = 0.5, f = 1;
  for (let o = 0; o < 4; o++) {
    s += amp * noise(x * f, y * f);
    amp *= 0.5;
    f *= 2.03;
  }
  return s;
};

// elevation in km as a function of position across the country (0 = south border, 1 = north)
function profile(t: number) {
  const bump = (c: number, w: number, h: number) => h * Math.exp(-((t - c) ** 2) / (2 * w * w));
  return 0.1 + bump(0.17, 0.035, 0.7) + bump(0.36, 0.06, 1.9) + 1.3 * Math.max(0, Math.min(1, (t - 0.38) / 0.25)) + bump(0.82, 0.09, 4.2);
}

const STEP = 4;
const cols = Math.ceil(W / STEP) + 1;
const rows = Math.ceil(H / STEP) + 1;

// Smoothed south/north border per column (removes jumps where the outline folds).
const rawB = Array.from({ length: cols }, (_, i) => borderAt(Math.min(Math.max(i * STEP, 2), W - 2)));
const smoothB = rawB.map((_, i) => {
  let s = 0, n = 0, c = 0;
  for (let k = -18; k <= 18; k++) {
    const b = rawB[i + k];
    if (!b) continue;
    s += b.s; n += b.n; c++;
  }
  return c ? { s: s / c, n: n / c } : { s: H * 0.9, n: H * 0.1 };
});

// Major north–south river valleys cut through the ranges (approximate longitudes).
const RIVERS = [80.35, 81.35, 82.0, 83.6, 84.4, 85.2, 86.4, 87.2, 87.65].map((lon) => project(lon, 28)[0]);
const valley = (x: number, y: number) => {
  let v = 0;
  for (const rx of RIVERS) {
    const wob = (fbm(y / 60 + rx, 3.3) - 0.5) * 40;
    v += Math.exp(-((x - rx - wob) ** 2) / (2 * 14 * 14));
  }
  return Math.min(1, v);
};

const field: number[] = new Array(cols * rows);
for (let j = 0; j < rows; j++) {
  for (let i = 0; i < cols; i++) {
    const x = i * STEP, y = j * STEP;
    const b = smoothB[i]!;
    const t = (b.s - y) / Math.max(60, b.s - b.n);
    const warp = (fbm(x / 90 + 4, y / 90 + 7) - 0.5) * 0.22;
    const tt = Math.max(-0.2, Math.min(1.25, t + warp));
    const ridges = 1 - Math.abs(fbm(x / 28 + 9, y / 28 - 3) * 2 - 1);
    let e = profile(tt);
    e += (ridges - 0.55) * (0.35 + 1.4 * Math.max(0, tt - 0.3));
    e -= valley(x, y) * (0.6 + 1.6 * Math.max(0, tt - 0.25));
    field[j * cols + i] = e;
  }
}

// ---------- marching squares ----------
type Seg = [number, number, number, number];
function contour(level: number): Seg[] {
  const segs: Seg[] = [];
  const at = (i: number, j: number) => field[j * cols + i]!;
  const lerp = (a: number, b: number) => (level - a) / (b - a);
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const tl = at(i, j), tr = at(i + 1, j), br = at(i + 1, j + 1), bl = at(i, j + 1);
      const idx = (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const x = i * STEP, y = j * STEP;
      const top: [number, number] = [x + STEP * lerp(tl, tr), y];
      const right: [number, number] = [x + STEP, y + STEP * lerp(tr, br)];
      const bottom: [number, number] = [x + STEP * lerp(bl, br), y + STEP];
      const left: [number, number] = [x, y + STEP * lerp(tl, bl)];
      const add = (a: [number, number], b: [number, number]) => segs.push([a[0], a[1], b[0], b[1]]);
      switch (idx) {
        case 1: case 14: add(left, bottom); break;
        case 2: case 13: add(bottom, right); break;
        case 3: case 12: add(left, right); break;
        case 4: case 11: add(top, right); break;
        case 5: add(left, top); add(bottom, right); break;
        case 6: case 9: add(top, bottom); break;
        case 7: case 8: add(left, top); break;
        case 10: add(left, bottom); add(top, right); break;
      }
    }
  }
  return segs;
}

function join(segs: Seg[]): [number, number][][] {
  const key = (x: number, y: number) => `${Math.round(x * 4)},${Math.round(y * 4)}`;
  const byStart = new Map<string, number[]>();
  segs.forEach((s, i) => {
    for (const k of [key(s[0], s[1]), key(s[2], s[3])]) {
      const list = byStart.get(k) ?? [];
      list.push(i);
      byStart.set(k, list);
    }
  });
  const used = new Uint8Array(segs.length);
  const lines: [number, number][][] = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const s = segs[i]!;
    const line: [number, number][] = [[s[0], s[1]], [s[2], s[3]]];
    for (const dir of [1, -1] as const) {
      for (;;) {
        const end = dir === 1 ? line[line.length - 1]! : line[0]!;
        const cands = byStart.get(key(end[0], end[1])) ?? [];
        const next = cands.find((c) => !used[c]);
        if (next === undefined) break;
        used[next] = 1;
        const n = segs[next]!;
        const p: [number, number] = key(n[0], n[1]) === key(end[0], end[1]) ? [n[2], n[3]] : [n[0], n[1]];
        if (dir === 1) line.push(p);
        else line.unshift(p);
      }
    }
    if (line.length > 10) lines.push(line);
  }
  return lines;
}

function simplify(line: [number, number][], every = 2) {
  return line.filter((_, i) => i % every === 0 || i === line.length - 1);
}

const levels = [0.35, 0.7, 1.05, 1.4, 1.8, 2.2, 2.65, 3.1, 3.6, 4.1, 4.6];
const contours = levels.map((level) => ({
  level,
  d: join(contour(level))
    .map((l) => simplify(l))
    .map((l) => l.map(([x, y], i) => `${i ? "L" : "M"}${r1(x)} ${r1(y)}`).join(""))
    .join(""),
}));

mkdirSync("src/generated", { recursive: true });
writeFileSync(
  "src/generated/nepal-geo.json",
  JSON.stringify({
    width: W,
    height: H,
    projection: { lonMin, latMax, k: K, scale },
    outline: outlinePath,
    contours,
    source: "Outline: Natural Earth 1:10m via world-atlas. Contours: illustrative, generated.",
  }),
);
console.log(`✓ nepal-geo.json  ${W}×${H}  outline ${ring.length} pts  contours ${contours.map((c) => c.d.length).reduce((a, b) => a + b)} chars`);
