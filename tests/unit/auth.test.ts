import { describe, expect, it } from "vitest";
import { CODE_PATTERN, codeMatches, hashCode, newSalt } from "@/server/auth/codes";
import { LIMITS, decide } from "@/server/auth/throttle";

const PEPPER = "test-pepper-0123456789abcdef0123456789abcdef";

describe("access-code hashing", () => {
  it("matches only the right code", () => {
    const salt = newSalt();
    const h = hashCode("4821", salt, PEPPER);
    expect(codeMatches("4821", salt, h, PEPPER)).toBe(true);
    expect(codeMatches("4822", salt, h, PEPPER)).toBe(false);
  });
  it("depends on the server pepper (a DB dump alone is not enough)", () => {
    const salt = newSalt();
    const h = hashCode("4821", salt, PEPPER);
    expect(codeMatches("4821", salt, h, `${PEPPER}x`)).toBe(false);
  });
  it("salts each credential", () => expect(hashCode("4821", newSalt(), PEPPER)).not.toBe(hashCode("4821", newSalt(), PEPPER)));
  it("never stores the code itself", () => expect(hashCode("4821", newSalt(), PEPPER)).not.toContain("4821"));
  it("accepts 4–12 digits only", () => {
    expect(CODE_PATTERN.test("1234")).toBe(true);
    expect(CODE_PATTERN.test("123")).toBe(false);
    expect(CODE_PATTERN.test("12a4")).toBe(false);
  });
});

describe("throttling", () => {
  const now = 1_800_000_000_000;
  const min = 60_000;
  it("allows a clean source", () => expect(decide({ sourceFailures: [], globalFailures: 0, globalOldest: null }, now)).toEqual({ allowed: true }));
  it("allows four recent failures", () => {
    const f = [1, 2, 3, 4].map((i) => now - i * min);
    expect(decide({ sourceFailures: f, globalFailures: 4, globalOldest: f.at(-1)! }, now).allowed).toBe(true);
  });
  it("locks a source after five failures in 15 minutes", () => {
    const f = [1, 2, 3, 4, 5].map((i) => now - i * min);
    const d = decide({ sourceFailures: f, globalFailures: 5, globalOldest: f.at(-1)! }, now);
    expect(d).toMatchObject({ allowed: false, scope: "source" });
  });
  it("releases the short lock once the window passes", () => {
    const f = [16, 17, 18, 19, 20].map((i) => now - i * min);
    expect(decide({ sourceFailures: f, globalFailures: 5, globalOldest: f.at(-1)! }, now).allowed).toBe(true);
  });
  it("locks a source for a day after twelve failures in 24 hours", () => {
    const f = Array.from({ length: 12 }, (_, i) => now - (i + 1) * 30 * min);
    const d = decide({ sourceFailures: f, globalFailures: 12, globalOldest: f.at(-1)! }, now);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.retryAfterMs).toBeGreaterThan(60 * min);
  });
  it("pauses all sign-ins under distributed guessing", () => {
    const d = decide({ sourceFailures: [], globalFailures: LIMITS.global.failures, globalOldest: now - 60 * min }, now);
    expect(d).toMatchObject({ allowed: false, scope: "global" });
  });
});
