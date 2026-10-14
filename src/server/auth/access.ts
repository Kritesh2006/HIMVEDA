import "server-only";
import { and, desc, eq, gt } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { CODE_PATTERN, codeMatches, getPepper, keyedDigest } from "./codes";
import { LIMITS, decide } from "./throttle";
import { clientIp, createSession } from "./session";
import { writeAudit } from "@/server/audit";

export type AccessResult =
  | { ok: true }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "locked"; retryAfterMinutes: number }
  | { ok: false; reason: "unavailable" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Verify an access code server-side.
 * - Throttle check happens BEFORE any hash comparison.
 * - Every attempt is recorded; the response never hints at partial correctness.
 * - All credentials are compared on every attempt (no early exit timing signal).
 */
export async function attemptAccess(rawCode: string): Promise<AccessResult> {
  const started = Date.now();
  let pepper: string;
  try {
    pepper = getPepper();
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  const sourceHash = keyedDigest(`access:${await clientIp()}`, pepper);
  const now = Date.now();

  const since = new Date(now - LIMITS.sourceLong.windowMs);
  const [sourceRows, globalRows] = await Promise.all([
    db
      .select({ t: schema.accessAttempts.createdAt })
      .from(schema.accessAttempts)
      .where(
        and(
          eq(schema.accessAttempts.sourceHash, sourceHash),
          eq(schema.accessAttempts.success, false),
          gt(schema.accessAttempts.createdAt, since),
        ),
      )
      .orderBy(desc(schema.accessAttempts.createdAt))
      .limit(50),
    db
      .select({ t: schema.accessAttempts.createdAt })
      .from(schema.accessAttempts)
      .where(
        and(
          eq(schema.accessAttempts.success, false),
          gt(schema.accessAttempts.createdAt, new Date(now - LIMITS.global.windowMs)),
        ),
      )
      .orderBy(schema.accessAttempts.createdAt)
      .limit(500),
  ]);

  const decision = decide(
    {
      sourceFailures: sourceRows.map((r) => r.t.getTime()),
      globalFailures: globalRows.length,
      globalOldest: globalRows[0]?.t.getTime() ?? null,
    },
    now,
  );
  if (!decision.allowed) {
    await sleep(600);
    return { ok: false, reason: "locked", retryAfterMinutes: Math.ceil(decision.retryAfterMs / 60_000) };
  }

  const code = rawCode.trim();
  let matched: typeof schema.adminCredentials.$inferSelect | null = null;
  if (CODE_PATTERN.test(code)) {
    const creds = await db.select().from(schema.adminCredentials).where(eq(schema.adminCredentials.active, true));
    for (const c of creds) {
      if (codeMatches(code, c.salt, c.codeHash, pepper) && !matched) matched = c;
    }
  }

  await db.insert(schema.accessAttempts).values({ sourceHash, success: Boolean(matched) });

  // Uniform minimum response time (~700 ms) regardless of outcome.
  const elapsed = Date.now() - started;
  if (elapsed < 700) await sleep(700 - elapsed + Math.floor(Math.random() * 150));

  if (!matched) {
    if (globalRows.length + 1 === LIMITS.global.failures) {
      await writeAudit(null, {
        action: "security.lockdown",
        entityType: "security",
        summary: `Owner access paused: ${LIMITS.global.failures} failed attempts in 24 hours`,
      });
    }
    return { ok: false, reason: "invalid" };
  }

  await db
    .update(schema.adminCredentials)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.adminCredentials.id, matched.id));
  await createSession(matched.userId, matched.id);
  await writeAudit(
    { userId: matched.userId, label: matched.label },
    { action: "session.login", entityType: "session", summary: `${matched.label} signed in to Studio` },
  );
  return { ok: true };
}
