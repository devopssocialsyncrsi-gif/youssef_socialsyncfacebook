import { db } from "@/db";
import { previewMedia } from "@/db/schema";
import { mediaJson } from "@/lib/preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ detail: "Choose a file to upload." }, { status: 400 });
    const max = Number(process.env.MAX_UPLOAD_MB || 200) * 1024 * 1024;
    if (file.size > max) return Response.json({ detail: `File exceeds the ${max / 1024 / 1024} MB limit.` }, { status: 413 });
    const ext = file.name.split(".").pop()?.toLowerCase();
    const types: Record<string, string> = { png: "image/png", mp4: "video/mp4", mp3: "audio/mpeg" };
    if (!ext || !types[ext] || file.type !== types[ext]) return Response.json({ detail: "Only PNG, MP4 and MP3 files with matching MIME types are supported." }, { status: 415 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const valid = ext === "png" ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : ext === "mp4" ? buffer.length >= 12 && buffer.subarray(4, 8).toString() === "ftyp" : buffer.subarray(0, 3).toString() === "ID3" || (buffer.length >= 2 && buffer[0] === 255 && (buffer[1] & 224) === 224);
    if (!valid) return Response.json({ detail: "The file contents do not match its declared type." }, { status: 415 });
    const [media] = await db.insert(previewMedia).values({ originalName: file.name.split(/[\\/]/).pop()!.slice(0, 255), mimeType: types[ext], sizeBytes: file.size, fileData: buffer }).returning();
    return Response.json(mediaJson(media), { status: 201 });
  } catch (error) {
    console.error(JSON.stringify({ service: "preview-media", event: "upload_failed", request_id: request.headers.get("x-request-id"), error: String(error) }));
    return Response.json({ detail: "Could not upload your file. Please try again." }, { status: 500 });
  }
}
