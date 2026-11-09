import { db } from "@/db";
import { previewPosts, previewTargets } from "@/db/schema";
import { isUuid, listPosts, platforms, type Platform } from "@/lib/preview";
import { and, eq } from "drizzle-orm";

type Context = { params: Promise<{ id: string; platform: string }> };
export async function POST(_request: Request, context: Context) {
  const { id, platform } = await context.params;
  if (!isUuid(id) || !platforms.includes(platform as Platform)) return Response.json({ detail: "Target not found" }, { status: 404 });
  const [target] = await db.select().from(previewTargets).where(and(eq(previewTargets.postId, id), eq(previewTargets.platform, platform))).limit(1);
  if (!target) return Response.json({ detail: "Target not found" }, { status: 404 });
  if (target.status !== "failed") return Response.json({ detail: "Only failed targets can be retried" }, { status: 409 });
  await db.update(previewTargets).set({ status: "pending", error: null, updatedAt: new Date() }).where(eq(previewTargets.id, target.id));
  await db.update(previewPosts).set({ status: "pending", updatedAt: new Date() }).where(eq(previewPosts.id, id));
  return Response.json((await listPosts(id))[0]);
}
