/**
 * Access-code hashing. Pure Node crypto, no `server-only` import so the CLI
 * registration script can share it. Never imported by client code.
 *
 * hash = scrypt( HMAC-SHA256(pepper, code), salt, N=2^15 )
 *
 * The pepper lives only in the server environment, so a database dump alone
 * is not enough to brute-force the (small) code space offline.
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const KEYLEN = 32;

export const CODE_PATTERN = /^\d{4,12}$/;

export function getPepper(): string {
  const pepper = process.env.ADMIN_CODE_PEPPER;
  if (!pepper || pepper.length < 32 || pepper.startsWith("<")) {
    throw new Error("ADMIN_CODE_PEPPER must be set to a 32+ character secret (see .env.example)");
  }
  return pepper;
}

export function newSalt(): string {
  return randomBytes(16).toString("hex");
}

export function hashCode(code: string, salt: string, pepper = getPepper()): string {
  const keyed = createHmac("sha256", pepper).update(code, "utf8").digest();
  return scryptSync(keyed, Buffer.from(salt, "hex"), KEYLEN, SCRYPT).toString("hex");
}

export function codeMatches(code: string, salt: string, expectedHex: string, pepper?: string): boolean {
  const actual = Buffer.from(hashCode(code, salt, pepper), "hex");
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** HMAC used to pseudonymise IPs / session tokens before storage. */
export function keyedDigest(value: string, pepper = getPepper()): string {
  return createHmac("sha256", pepper).update(value, "utf8").digest("hex");
}
