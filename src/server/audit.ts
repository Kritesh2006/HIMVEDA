import "server-only";
import { db, schema, type DB } from "@/server/db";

export interface Actor {
  userId: string;
  label: string;
}

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  before?: unknown;
  after?: unknown;
}

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

/** Append an audit record. Pass a transaction to keep it atomic with the change it describes. */
export async function writeAudit(actor: Actor | null, entry: AuditEntry, tx?: Tx | DB): Promise<void> {
  const exec = tx ?? db;
  await exec.insert(schema.auditLogs).values({
    actorUserId: actor?.userId ?? null,
    actorLabel: actor?.label ?? "System",
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    summary: entry.summary,
    before: entry.before === undefined ? null : (entry.before as object),
    after: entry.after === undefined ? null : (entry.after as object),
  });
}

export function actorOf(s: { userId: string; label: string }): Actor {
  return { userId: s.userId, label: s.label };
}
