import styles from "./Specimen.module.css";

/**
 * Specimen plate — HIMVEDA's product illustration system.
 * Each commodity is drawn as botanical line work on a plate with registration
 * marks, so products have a consistent, honest visual until real photography
 * is uploaded in Studio. Pure SVG, no network, no stock photos posing as product.
 */

type Visual = "pod" | "seed" | "leaf" | "grain" | "root" | "berry" | "flower" | "honey";

const r = (n: number) => Math.round(n * 10) / 10;

function Pod({ x, y, a, l = 34, w = 15 }: { x: number; y: number; a: number; l?: number; w?: number }) {
  const outer = `M${x - l} ${y} C${x - l * 0.55} ${y - w} ${x + l * 0.45} ${y - w * 1.05} ${x + l} ${y} C${x + l * 0.45} ${y + w * 1.05} ${x - l * 0.55} ${y + w} ${x - l} ${y}Z`;
  const rib = (k: number) => `M${x - l * 0.92} ${y} C${x - l * 0.5} ${y - w * k} ${x + l * 0.4} ${y - w * k} ${x + l * 0.95} ${y}`;
  return (
    <g transform={`rotate(${a} ${x} ${y})`}>
      <path d={outer} className={styles.fill} />
      <path d={rib(0.62)} />
      <path d={rib(0.2)} />
      <path d={rib(-0.25)} />
      <path d={rib(-0.66)} />
      <path d={`M${x - l} ${y} q-9 -2 -13 -9`} />
    </g>
  );
}

function Leaf({ x, y, a, l = 70, w = 26, veins = 5 }: { x: number; y: number; a: number; l?: number; w?: number; veins?: number }) {
  const shape = `M0 0 C${l * 0.25} ${-w} ${l * 0.7} ${-w * 0.9} ${l} 0 C${l * 0.7} ${w * 0.9} ${l * 0.25} ${w} 0 0Z`;
  const vs = Array.from({ length: veins }, (_, i) => {
    const t = (i + 1) / (veins + 1);
    const vx = l * t;
    const vw = Math.sin(Math.PI * t) * w * 0.72;
    return `M${r(vx)} 0 q${r(l * 0.08)} ${r(-vw * 0.6)} ${r(l * 0.14)} ${r(-vw)} M${r(vx)} 0 q${r(l * 0.08)} ${r(vw * 0.6)} ${r(l * 0.14)} ${r(vw)}`;
  });
  return (
    <g transform={`translate(${x} ${y}) rotate(${a})`}>
      <path d={shape} className={styles.fill} />
      <path d={`M0 0 L${l * 0.97} 0`} />
      <path d={vs.join(" ")} className={styles.fine} />
    </g>
  );
}

function Capsule({ x, y, a, l, w }: { x: number; y: number; a: number; l: number; w: number }) {
  const rings = Array.from({ length: Math.max(2, Math.floor(l / 13)) }, (_, i) => {
    const px = -l / 2 + ((i + 1) * l) / (Math.floor(l / 13) + 1);
    return `M${r(px)} ${-w / 2 + 1.5} q${r(w * 0.22)} ${r(w / 2)} 0 ${r(w - 3)}`;
  });
  return (
    <g transform={`translate(${x} ${y}) rotate(${a})`}>
      <rect x={-l / 2} y={-w / 2} width={l} height={w} rx={w / 2} className={styles.fill} />
      <path d={rings.join(" ")} className={styles.fine} />
    </g>
  );
}

function Drawing({ visual }: { visual: Visual }) {
  switch (visual) {
    case "pod":
      return (
        <g>
          <Pod x={92} y={84} a={-28} />
          <Pod x={118} y={122} a={14} l={30} w={13} />
          <Pod x={70} y={136} a={-62} l={27} w={12} />
        </g>
      );
    case "leaf":
      return (
        <g>
          <path d="M100 178 C 98 150, 96 120, 100 66" />
          <Leaf x={99} y={128} a={-148} l={62} w={22} />
          <Leaf x={99} y={104} a={-34} l={56} w={20} />
          <Leaf x={100} y={70} a={-92} l={36} w={9} veins={3} />
          <path d="M100 150 q -14 4 -22 14 M100 150 q 10 6 14 18" className={styles.fine} />
        </g>
      );
    case "grain": {
      const grains: string[] = [];
      const pts: { x: number; y: number; a: number }[] = [];
      for (let i = 0; i < 13; i++) {
        const t = i / 12;
        const x = 120 - 46 * t + 18 * Math.sin(t * 3);
        const y = 176 - 140 * t;
        const side = i % 2 ? 1 : -1;
        pts.push({ x: x + side * 11, y: y - 4, a: -70 + side * 40 + t * 30 });
        grains.push(`M${r(x)} ${r(y)} l${side * 9} -6`);
      }
      return (
        <g>
          <path d="M120 180 C 112 130, 92 80, 76 34" />
          <path d={grains.join(" ")} className={styles.fine} />
          {pts.map((p, i) => (
            <g key={i} transform={`translate(${r(p.x)} ${r(p.y)}) rotate(${r(p.a)})`}>
              <ellipse cx={0} cy={0} rx={10} ry={4.6} className={styles.fill} />
              <path d="M-9 0 L9 0" className={styles.fine} />
            </g>
          ))}
        </g>
      );
    }
    case "root":
      return (
        <g>
          <Capsule x={98} y={112} a={-8} l={92} w={26} />
          <Capsule x={64} y={82} a={-58} l={46} w={18} />
          <Capsule x={102} y={74} a={-84} l={42} w={17} />
          <Capsule x={136} y={86} a={-122} l={44} w={18} />
          <Capsule x={128} y={142} a={38} l={38} w={16} />
          <path d="M60 126 q -10 14 -6 28 M74 128 q -4 16 4 26 M92 126 q 2 12 -2 22" className={styles.fine} />
        </g>
      );
    case "berry": {
      const berries = [
        [86, 74], [104, 70], [96, 88], [116, 86], [78, 94], [108, 104], [90, 108], [126, 104], [100, 122], [118, 124],
      ] as const;
      return (
        <g>
          <path d="M100 178 C 100 160, 102 146, 104 132" />
          <path d="M104 132 L100 122 M104 132 L118 124 M100 122 L90 108 M100 122 L108 104 M108 104 L104 70 M108 104 L116 86 M108 104 L126 104 M90 108 L78 94 M90 108 L96 88 M96 88 L86 74" className={styles.fine} />
          {berries.map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={7.5} className={styles.fill} />
              <path d={`M${x - 3.5} ${y - 2.5} a4 4 0 0 1 4 -3`} className={styles.fine} />
            </g>
          ))}
          <Leaf x={103} y={150} a={-160} l={40} w={11} veins={3} />
          <Leaf x={103} y={148} a={-24} l={36} w={10} veins={3} />
        </g>
      );
    }
    case "seed": {
      const seeds = [
        [72, 80, 10], [108, 70, -24], [134, 96, 40], [84, 116, -60], [118, 126, 18], [96, 150, 70], [60, 138, -20],
      ] as const;
      return (
        <g>
          {seeds.map(([x, y, a], i) => (
            <g key={i} transform={`translate(${x} ${y}) rotate(${a})`}>
              <path d="M0 -15 L13 9 L-13 9 Z" className={styles.fill} strokeLinejoin="round" />
              <path d="M0 -15 L0 2 M0 2 L13 9 M0 2 L-13 9" className={styles.fine} />
            </g>
          ))}
        </g>
      );
    }
    case "flower":
      return (
        <g>
          <path d="M100 178 C 100 150, 100 130, 100 104" />
          {[0, 72, 144, 216, 288].map((a) => (
            <Leaf key={a} x={100} y={100} a={a - 90} l={42} w={16} veins={2} />
          ))}
          <circle cx={100} cy={100} r={7} className={styles.fill} />
        </g>
      );
    case "honey": {
      const hex = (cx: number, cy: number, s = 16) =>
        Array.from({ length: 6 }, (_, i) => {
          const a = (Math.PI / 3) * i + Math.PI / 6;
          return `${i ? "L" : "M"}${r(cx + s * Math.cos(a))} ${r(cy + s * Math.sin(a))}`;
        }).join("") + "Z";
      const cells = [
        [100, 100], [128, 100], [72, 100], [86, 76], [114, 76], [86, 124], [114, 124], [142, 124], [58, 124],
      ] as const;
      return (
        <g>
          {cells.map(([x, y], i) => (
            <path key={i} d={hex(x, y)} className={i % 3 === 0 ? styles.fill : undefined} />
          ))}
        </g>
      );
    }
  }
}

export function Specimen({
  visual,
  label,
  code,
  className,
  size = "card",
}: {
  visual: string;
  label?: string | null;
  code?: string | null;
  className?: string;
  size?: "card" | "hero" | "thumb";
}) {
  const v = (["pod", "seed", "leaf", "grain", "root", "berry", "flower", "honey"].includes(visual) ? visual : "leaf") as Visual;
  return (
    <div className={`${styles.plate} ${className ?? ""}`} data-size={size} aria-hidden="true">
      <svg viewBox="0 0 200 200" className={styles.svg}>
        <g className={styles.rings}>
          {[38, 58, 78, 98].map((rad) => (
            <circle key={rad} cx={100} cy={108} r={rad} />
          ))}
        </g>
        <g className={styles.ticks}>
          <path d="M8 18 V8 H18 M182 8 H192 V18 M192 182 V192 H182 M18 192 H8 V182" />
        </g>
        <g className={styles.ink} transform="translate(100 108) scale(1.28) translate(-100 -108)">
          <Drawing visual={v} />
        </g>
      </svg>
      {size !== "thumb" && (label || code) ? (
        <div className={styles.caption}>
          {label ? <span className="deva">{label}</span> : <span />}
          {code ? <span className="code">{code}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
