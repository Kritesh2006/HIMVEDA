import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";

/** Serves uploaded media. IDs are random UUIDs; files are immutable, so cache for a year. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const [m] = await db.select().from(schema.media).where(eq(schema.media.id, id)).limit(1);
  if (!m) return new Response("Not found", { status: 404 });
  if (m.externalUrl) return Response.redirect(m.externalUrl, 302);
  if (!m.data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(m.data), {
    headers: {
      "Content-Type": m.mimeType,
      "Content-Length": String(m.byteSize),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": m.mimeType === "application/pdf" ? `inline; filename="${m.filename.replace(/[^\w.-]/g, "_")}"` : "inline",
    },
  });
}
