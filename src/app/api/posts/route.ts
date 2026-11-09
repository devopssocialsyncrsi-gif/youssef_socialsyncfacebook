import { db } from "@/db";
import { previewMedia, previewPosts, previewTargets } from "@/db/schema";
import { isUuid, limits, listPosts, platforms, type Platform } from "@/lib/preview";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export async function GET() {
  try { return Response.json(await listPosts()); }
  catch (error) { console.error("Preview posts:", error); return Response.json({ detail: "Could not load post history." }, { status: 500 }); }
}
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const caption = typeof body.caption === "string" ? body.caption : "";
    const selected = body.platforms;
    if (!title || title.length > 100 || !caption.trim() || !isUuid(String(body.media_id || "")) || !Array.isArray(selected) || !selected.length || selected.length > 4 || new Set(selected).size !== selected.length || selected.some((p: unknown) => typeof p !== "string" || !platforms.includes(p as Platform))) return Response.json({ detail: "Please provide a title, caption, media file and valid platforms." }, { status: 400 });
    const [media] = await db.select().from(previewMedia).where(eq(previewMedia.id, body.media_id)).limit(1);
    if (!media) return Response.json({ detail: "Media not found." }, { status: 404 });
    for (const platform of selected as Platform[]) {
      if (caption.length > limits[platform]) return Response.json({ detail: `${platform} caption is too long.` }, { status: 400 });
      if (platform === "youtube" && media.mimeType === "image/png") return Response.json({ detail: "YouTube requires a video or audio file." }, { status: 400 });
    }
    const post = await db.transaction(async tx => {
      const [created] = await tx.insert(previewPosts).values({ title, caption, mediaId: media.id }).returning();
      await tx.insert(previewTargets).values((selected as Platform[]).map(platform => ({ postId: created.id, platform })));
      return created;
    });
    return Response.json((await listPosts(post.id))[0], { status: 201 });
  } catch (error) {
    console.error(JSON.stringify({ service: "preview-posts", event: "create_failed", request_id: request.headers.get("x-request-id"), error: String(error) }));
    return Response.json({ detail: "Could not create your post. Please try again." }, { status: 500 });
  }
}
