export const fmtDate = (iso: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  iso ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", ...opts }).format(typeof iso === "string" ? new Date(iso) : iso) : "—";

export const fmtKg = (kg: number | null | undefined, digits = 1) =>
  kg == null ? "—" : `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(kg)} kg`;

export const fmtInt = (n: number | null | undefined) => (n == null ? "—" : new Intl.NumberFormat("en-IN").format(n));

export const STAGE_LABEL: Record<string, string> = {
  origin: "Field",
  collected: "Collection",
  inspected: "Inspection",
  verified: "Verification",
  processed: "Processing",
  packaged: "Packed",
  available: "On the market",
  sold_out: "Sold out",
};

export const METRIC_LABEL: Record<string, string> = {
  producers: "Producers",
  netKg: "Net weight",
  receipts: "Receipts",
  avgMoisturePct: "Avg. moisture",
  acceptedKg: "Accepted",
  inKg: "Into processing",
  outKg: "Out of processing",
  packs: "Packs",
};

export function fmtMetric(key: string, v: number | string): string {
  if (typeof v === "string") return v;
  if (key.endsWith("Kg")) return fmtKg(v);
  if (key.endsWith("Pct")) return `${v}%`;
  return fmtInt(v);
}
