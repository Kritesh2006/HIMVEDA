/**
 * Fails if secrets appear in git-tracked files or in the built client bundle.
 *
 *   SECRET_SCAN_VALUES="<code1>,<code2>,<code3>" npm run check:secrets
 *
 * Pass the real access codes through the environment at scan time — never
 * write them into this file. Generic patterns are checked as well.
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const values = (process.env.SECRET_SCAN_VALUES ?? "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
for (const k of ["ADMIN_CODE_PEPPER", "CRON_SECRET", "FX_API_KEY"]) {
  const v = process.env[k];
  if (v && v.length >= 12 && !v.startsWith("<")) values.push(v);
}

const patterns: [string, RegExp][] = [
  ["admin code assignment", /ADMIN_CODE_\d\s*=\s*\d{4,}/],
  ["database URL with password", /postgres(?:ql)?:\/\/[^:\s/]+:(?!PASSWORD@|<)[^@\s]+@(?!localhost|HOST)/i],
  ["private key", /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/],
];

const hits: string[] = [];
function scan(file: string, text: string, isBundle: boolean) {
  for (const v of values) {
    const re = /^\d+$/.test(v) ? new RegExp(`(?<![\\w.-])${v}(?![\\w.-])`) : new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    // numeric codes: in bundles, only flag string literals (avoid matching e.g. sizes or dates)
    if (/^\d+$/.test(v) && isBundle) {
      if (text.includes(`"${v}"`) || text.includes(`'${v}'`)) hits.push(`${file}: contains a configured secret value`);
    } else if (re.test(text)) hits.push(`${file}: contains a configured secret value`);
  }
  for (const [name, re] of patterns) if (re.test(text)) hits.push(`${file}: ${name}`);
}

const tracked = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
for (const f of tracked) {
  if (/\.(png|jpe?g|webp|avif|woff2?|ico)$/.test(f) || f === "package-lock.json") continue;
  scan(f, readFileSync(f, "utf8"), false);
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
if (existsSync(".next/static")) for (const f of walk(".next/static").filter((f) => f.endsWith(".js"))) scan(f, readFileSync(f, "utf8"), true);

if (hits.length) {
  console.error(`✗ ${hits.length} potential secret(s):\n  ${[...new Set(hits)].join("\n  ")}`);
  process.exit(1);
}
console.log(`✓ no secrets found in ${tracked.length} tracked files${existsSync(".next/static") ? " or the client bundle" : ""} (${values.length} configured values checked)`);
