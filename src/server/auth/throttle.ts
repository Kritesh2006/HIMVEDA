/**
 * Brute-force protection for 4-digit access codes (only 10,000 combinations).
 * State lives in Postgres so limits hold across serverless instances.
 *
 *  Per source (HMAC of client IP):
 *   - 5 failures within 15 min  → locked 15 min
 *   - 12 failures within 24 h   → locked 24 h
 *  Global (all sources, defends against distributed guessing):
 *   - 40 failures within 24 h   → ALL logins paused until the window clears,
 *                                 and a security event is written to the audit log.
 *
 * With these limits an attacker gets at most ~40 guesses/day against a space
 * of 10,000 → the expected time to hit one of three codes exceeds two months,
 * and the owner sees the lockdown in Studio long before that.
 * Longer codes (up to 12 digits) are supported and strongly recommended.
 */
export const LIMITS = {
  sourceShort: { failures: 5, windowMs: 15 * 60_000, lockMs: 15 * 60_000 },
  sourceLong: { failures: 12, windowMs: 24 * 3600_000, lockMs: 24 * 3600_000 },
  global: { failures: 40, windowMs: 24 * 3600_000 },
} as const;

export interface AttemptStats {
  /** failure timestamps for this source within the long window, newest first */
  sourceFailures: number[];
  /** failure count across all sources within the global window */
  globalFailures: number;
  /** oldest failure timestamp across all sources within the global window */
  globalOldest: number | null;
}

export type ThrottleDecision = { allowed: true } | { allowed: false; retryAfterMs: number; scope: "source" | "global" };

export function decide(stats: AttemptStats, now: number): ThrottleDecision {
  const { sourceShort, sourceLong, global } = LIMITS;

  if (stats.globalFailures >= global.failures && stats.globalOldest !== null) {
    return { allowed: false, scope: "global", retryAfterMs: Math.max(1000, stats.globalOldest + global.windowMs - now) };
  }

  const recentLong = stats.sourceFailures.filter((t) => now - t < sourceLong.windowMs);
  if (recentLong.length >= sourceLong.failures) {
    const nth = recentLong[sourceLong.failures - 1]!;
    return { allowed: false, scope: "source", retryAfterMs: Math.max(1000, nth + sourceLong.lockMs - now) };
  }

  const recentShort = recentLong.filter((t) => now - t < sourceShort.windowMs);
  if (recentShort.length >= sourceShort.failures) {
    const nth = recentShort[sourceShort.failures - 1]!;
    return { allowed: false, scope: "source", retryAfterMs: Math.max(1000, nth + sourceShort.lockMs - now) };
  }
  return { allowed: true };
}
