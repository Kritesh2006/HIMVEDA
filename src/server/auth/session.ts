import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { keyedDigest } from "./codes";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-hv_session" : "hv_session";
export const EDIT_MODE_COOKIE = "hv_edit";
const ABSOLUTE_TTL_MS = 12 * 3600_000;
const IDLE_TTL_MS = 2 * 3600_000;
const TOUCH_EVERY_MS = 5 * 60_000;

export interface EditorSession {
  sessionId: string;
  userId: string;
  label: string; // "Editor 2" — internal only
  displayName: string;
  role: "owner" | "editor";
  expiresAt: Date;
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("cf-connecting-ip") ??
    "unknown"
  );
}

export async function createSession(userId: string, credentialId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const h = await headers();
  await db.insert(schema.adminSessions).values({
    tokenHash: sha256(token),
    userId,
    credentialId,
    expiresAt: new Date(now + ABSOLUTE_TTL_MS),
    ipHash: keyedDigest(await clientIp()),
    userAgent: h.get("user-agent")?.slice(0, 200) ?? null,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ABSOLUTE_TTL_MS / 1000,
  });
}

/** Resolve the current editor session (once per request). Returns null for visitors. */
export const getEditorSession = cache(async (): Promise<EditorSession | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length < 32 || token.length > 64) return null;
  const now = new Date();
  const row = await db.query.adminSessions.findFirst({
    where: and(
      eq(schema.adminSessions.tokenHash, sha256(token)),
      isNull(schema.adminSessions.revokedAt),
      gt(schema.adminSessions.expiresAt, now),
    ),
    with: { user: true, credential: true },
  });
  if (!row || !row.user.active || (row.credential && !row.credential.active)) return null;
  if (now.getTime() - row.lastSeenAt.getTime() > IDLE_TTL_MS) return null;
  if (now.getTime() - row.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    await db.update(schema.adminSessions).set({ lastSeenAt: now }).where(eq(schema.adminSessions.id, row.id));
  }
  return {
    sessionId: row.id,
    userId: row.userId,
    label: row.credential?.label ?? row.user.displayName,
    displayName: row.user.displayName,
    role: row.user.role,
    expiresAt: row.expiresAt,
  };
});

/** For Studio pages: redirect visitors to the access screen. */
export async function requireEditorPage(): Promise<EditorSession> {
  const s = await getEditorSession();
  if (!s) redirect("/owner");
  return s;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Not authorised");
  }
}

/** For server actions / route handlers: authorisation is re-checked on every mutation. */
export async function requireEditor(): Promise<EditorSession> {
  const s = await getEditorSession();
  if (!s) throw new UnauthorizedError();
  return s;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db
      .update(schema.adminSessions)
      .set({ revokedAt: new Date() })
      .where(eq(schema.adminSessions.tokenHash, sha256(token)));
  }
  jar.delete(SESSION_COOKIE);
  jar.delete(EDIT_MODE_COOKIE);
}

export async function isEditMode(): Promise<boolean> {
  const s = await getEditorSession();
  if (!s) return false;
  const jar = await cookies();
  return jar.get(EDIT_MODE_COOKIE)?.value === "1";
}
