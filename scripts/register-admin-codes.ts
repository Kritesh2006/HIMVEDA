/**
 * Registers the authorised Studio access codes — run PRIVATELY, never in CI.
 *
 *   ADMIN_CODE_1=•••• ADMIN_CODE_2=•••• ADMIN_CODE_3=•••• npm run admin:register
 *
 * or run without variables to be prompted (input is not echoed).
 *
 * Only salted, peppered scrypt hashes are written to the database. The plain
 * codes are never logged, written to disk or sent to the browser. Remove the
 * ADMIN_CODE_* variables from your environment afterwards; the app does not use them.
 */
import { createInterface } from "node:readline";
import { eq } from "drizzle-orm";
import { db, pool, schema } from "./db";
import { CODE_PATTERN, getPepper, hashCode, newSalt } from "../src/server/auth/codes";

const SLOTS = [1, 2, 3];

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = process.stdout as unknown as { write: (s: string) => boolean };
    const origWrite = out.write.bind(process.stdout);
    let muted = false;
    out.write = (s: string) => (muted && !s.includes(question) ? true : origWrite(s));
    rl.question(question, (answer) => {
      out.write = origWrite;
      origWrite("\n");
      rl.close();
      resolve(answer.trim());
    });
    muted = true;
  });
}

async function main() {
  getPepper(); // fail fast if the pepper is missing
  const codes: { slot: number; code: string }[] = [];
  for (const slot of SLOTS) {
    let code = process.env[`ADMIN_CODE_${slot}`]?.trim() ?? "";
    if (!code || code.startsWith("<")) {
      if (!process.stdin.isTTY) throw new Error(`ADMIN_CODE_${slot} is not set`);
      code = await promptHidden(`Access code for Editor ${slot}: `);
    }
    if (!CODE_PATTERN.test(code)) throw new Error(`Code for slot ${slot} must be 4–12 digits`);
    codes.push({ slot, code });
  }
  if (new Set(codes.map((c) => c.code)).size !== codes.length) throw new Error("Each editor needs a different code");

  for (const { slot, code } of codes) {
    const label = `Editor ${slot}`;
    const existing = await db.query.adminCredentials.findFirst({ where: eq(schema.adminCredentials.slot, slot) });
    const salt = newSalt();
    const codeHash = hashCode(code, salt);
    if (existing) {
      await db.update(schema.adminCredentials).set({ salt, codeHash, active: true }).where(eq(schema.adminCredentials.id, existing.id));
      await db.update(schema.adminSessions).set({ revokedAt: new Date() }).where(eq(schema.adminSessions.credentialId, existing.id));
      console.log(`✓ ${existing.label}: code rotated, existing sessions signed out`);
    } else {
      const [user] = await db
        .insert(schema.users)
        .values({ displayName: label, role: slot === 1 ? "owner" : "editor" })
        .returning();
      await db.insert(schema.adminCredentials).values({ userId: user!.id, label, slot, salt, codeHash });
      console.log(`✓ ${label}: registered`);
    }
  }
  await db.insert(schema.auditLogs).values({
    actorLabel: "System",
    action: "security.codes.register",
    entityType: "security",
    summary: `Access codes registered or rotated for ${codes.length} editors`,
  });
  console.log("Done. You can now remove ADMIN_CODE_* from your environment.");
}

main()
  .catch((e) => {
    console.error(`✗ ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
