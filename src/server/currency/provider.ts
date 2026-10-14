import "server-only";
import { CURRENCY_CODES, type CurrencyCode } from "@/lib/currency/config";
import { DEV_NPR_PER_UNIT, DEV_RATE_SOURCE } from "./dev-rates";

/** Rates expressed as units of `currency` per 1 NPR. */
export type RateTable = Partial<Record<CurrencyCode, number>>;

export interface FxProvider {
  readonly name: string;
  fetchRates(): Promise<RateTable>;
}

export class DevStaticProvider implements FxProvider {
  readonly name = DEV_RATE_SOURCE;
  async fetchRates(): Promise<RateTable> {
    const out: RateTable = { NPR: 1 };
    for (const [code, nprPerUnit] of Object.entries(DEV_NPR_PER_UNIT)) {
      out[code as CurrencyCode] = 1 / nprPerUnit;
    }
    return out;
  }
}

/** https://www.exchangerate-api.com — v6 "latest" endpoint with NPR as base. */
export class ExchangeRateApiProvider implements FxProvider {
  readonly name = "exchangerate-api";
  constructor(private readonly apiKey: string) {}
  async fetchRates(): Promise<RateTable> {
    const res = await fetch(`https://v6.exchangerate-api.com/v6/${encodeURIComponent(this.apiKey)}/latest/NPR`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`FX provider HTTP ${res.status}`);
    const body = (await res.json()) as { result?: string; conversion_rates?: Record<string, number> };
    if (body.result !== "success" || !body.conversion_rates) throw new Error("FX provider returned no rates");
    const out: RateTable = {};
    for (const code of CURRENCY_CODES) {
      const r = body.conversion_rates[code];
      if (typeof r === "number" && r > 0) out[code] = r;
    }
    return out;
  }
}

export function getFxProvider(): FxProvider {
  const name = process.env.FX_PROVIDER?.trim();
  const key = process.env.FX_API_KEY?.trim();
  if (name === "exchangerate-api" && key) return new ExchangeRateApiProvider(key);
  return new DevStaticProvider();
}
