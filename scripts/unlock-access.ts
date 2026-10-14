/** Emergency: clear access-attempt throttling (e.g. after a lockdown). Run privately. */
import { db, pool, schema } from "./db";

const rows = await db.delete(schema.accessAttempts).returning();
await db.insert(schema.auditLogs).values({ actorLabel: "System", action: "security.unlock", entityType: "security", summary: `Access throttling cleared from the command line (${rows.length} attempts removed)` });
console.log(`✓ cleared ${rows.length} access attempts`);
await pool.end();
