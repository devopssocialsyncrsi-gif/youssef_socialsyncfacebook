import { db } from "@/db";
import { previewMedia } from "@/db/schema";
import { isUuid, mediaJson } from "@/lib/preview";
import { eq } from "drizzle-orm";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ detail: "Media not found" }, { status: 404 });
  const [media] = await db.select().from(previewMedia).where(eq(previewMedia.id, id)).limit(1);
  return media ? Response.json(mediaJson(media)) : Response.json({ detail: "Media not found" }, { status: 404 });
}
export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ detail: "Media not found" }, { status: 404 });
  try { await db.delete(previewMedia).where(eq(previewMedia.id, id)); return new Response(null, { status: 204 }); }
  catch { return Response.json({ detail: "Media is in use by a post" }, { status: 409 }); }
}
