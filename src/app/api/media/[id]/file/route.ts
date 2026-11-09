import { db } from "@/db";
import { previewMedia } from "@/db/schema";
import { isUuid } from "@/lib/preview";
import { eq } from "drizzle-orm";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const [media] = await db.select().from(previewMedia).where(eq(previewMedia.id, id)).limit(1);
  if (!media) return new Response("Not found", { status: 404 });
  const bytes = media.fileData; const size = bytes.length;
  const range = request.headers.get("range");
  let start = 0; let end = size - 1; let status = 200;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    if (!match[1]) start = Math.max(0, size - Number(match[2]));
    else { start = Number(match[1]); if (match[2]) end = Math.min(Number(match[2]), size - 1); }
    if (start >= size || start > end || (!match[1] && Number(match[2]) === 0)) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    status = 206;
  }
  const headers = new Headers({ "Content-Type": media.mimeType, "Accept-Ranges": "bytes", "Content-Length": String(end - start + 1) });
  if (status === 206) headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  return new Response(new Uint8Array(bytes.subarray(start, end + 1)), { status, headers });
}
