/**
 * Production-safe credential sync: the deployment receives only pre-computed
 * hashes, never the codes themselves.
 *
 *   ADMIN_CREDENTIAL_HASHES="1:<salt>:<hash>;2:<salt>:<hash>;3:<salt>:<hash>" npm run admin:sync
 *
 * Generate the value privately with `npm run admin:hash` (prompts for codes,
 * uses the same ADMIN_CODE_PEPPER as production). Safe to run on every deploy:
 * unchanged hashes are left alone, so sessions are not disturbed.
 */
import { eq } from "drizzle-orm";
import { db, pool, schema } from "./db";

const raw = process.env.ADMIN_CREDENTIAL_HASHES?.trim();
if (!raw) {
  console.log("ADMIN_CREDENTIAL_HASHES not set — skipping credential sync");
  await pool.end();
  process.exit(0);
}
const entries = raw.split(";").map((e) => e.trim()).filter(Boolean).map((e) => {
  const [slot, salt, hash] = e.split(":");
  if (!/^\d+$/.test(slot ?? "") || !/^[0-9a-f]{32}$/.test(salt ?? "") || !/^[0-9a-f]{64}$/.test(hash ?? "")) {
    throw new Error("ADMIN_CREDENTIAL_HASHES is malformed (expected slot:salt:hash;…)");
  }
  return { slot: Number(slot), salt: salt!, hash: hash! };
});

let changed = 0;
for (const e of entries) {
  const label = `Editor ${e.slot}`;
  const existing = await db.query.adminCredentials.findFirst({ where: eq(schema.adminCredentials.slot, e.slot) });
  if (existing) {
    if (existing.codeHash === e.hash && existing.salt === e.salt) continue;
    await db.update(schema.adminCredentials).set({ salt: e.salt, codeHash: e.hash, active: true }).where(eq(schema.adminCredentials.id, existing.id));
    await db.update(schema.adminSessions).set({ revokedAt: new Date() }).where(eq(schema.adminSessions.credentialId, existing.id));
  } else {
    const [user] = await db.insert(schema.users).values({ displayName: label, role: e.slot === 1 ? "owner" : "editor" }).returning();
    await db.insert(schema.adminCredentials).values({ userId: user!.id, label, slot: e.slot, salt: e.salt, codeHash: e.hash });
  }
  changed++;
}
if (changed) {
  await db.insert(schema.auditLogs).values({ actorLabel: "System", action: "security.codes.sync", entityType: "security", summary: `Access-code hashes synced for ${changed} editor(s) at deploy` });
}
console.log(`✓ credential sync: ${changed} updated, ${entries.length - changed} unchanged`);
await pool.end();
