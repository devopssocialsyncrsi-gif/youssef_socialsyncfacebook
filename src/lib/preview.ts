import { db } from "@/db";
import { previewPosts, previewTargets, previewMedia } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";

export const platforms = ["linkedin", "facebook", "instagram", "youtube"] as const;
export type Platform = typeof platforms[number];
export const limits: Record<Platform, number> = { linkedin: 3000, facebook: 63206, instagram: 2200, youtube: 5000 };
export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function mediaJson(media: typeof previewMedia.$inferSelect) {
  const converted = media.mimeType === "audio/mpeg";
  return { id: media.id, original_name: media.originalName, mime_type: media.mimeType, size_bytes: media.sizeBytes, converted, publish_mime_type: converted ? "video/mp4" : media.mimeType, created_at: media.createdAt.toISOString() };
}

export async function listPosts(id?: string) {
  const posts = id
    ? await db.select().from(previewPosts).where(eq(previewPosts.id, id)).limit(1)
    : await db.select().from(previewPosts).orderBy(desc(previewPosts.createdAt)).limit(200);
  if (!posts.length) return [];
  const targets = await db.select().from(previewTargets).where(inArray(previewTargets.postId, posts.map(p => p.id)));
  const now = new Date();
  for (const target of targets) {
    const elapsed = now.getTime() - target.updatedAt.getTime();
    const post = posts.find(p => p.id === target.postId)!;
    if (target.status === "pending" && elapsed >= 1800) {
      target.status = "processing"; target.attempts += 1; target.updatedAt = now;
      await db.update(previewTargets).set({ status: target.status, attempts: target.attempts, updatedAt: now }).where(eq(previewTargets.id, target.id));
    } else if (target.status === "processing" && elapsed >= 2500) {
      const shouldFail = post.caption.includes("#simulate-failure") && target.attempts === 1;
      target.status = shouldFail ? "failed" : "published";
      target.error = shouldFail ? "Simulated failure. Retry this channel to try again." : null;
      target.externalId = shouldFail ? null : `demo-${target.id.slice(0, 8)}`;
      const base: Record<string, string> = { linkedin: "https://www.linkedin.com/feed/", facebook: "https://www.facebook.com/", instagram: "https://www.instagram.com/", youtube: "https://www.youtube.com/" };
      target.externalUrl = shouldFail ? null : base[target.platform]; target.updatedAt = now;
      await db.update(previewTargets).set({ status: target.status, error: target.error, externalId: target.externalId, externalUrl: target.externalUrl, updatedAt: now }).where(eq(previewTargets.id, target.id));
    }
  }
  return Promise.all(posts.map(async post => {
    const postTargets = targets.filter(target => target.postId === post.id);
    const statuses = postTargets.map(target => target.status);
    const status = statuses.includes("processing") ? "processing" : statuses.includes("pending") ? "pending" : statuses.includes("failed") ? "failed" : "published";
    if (post.status !== status) {
      post.status = status; post.updatedAt = now;
      await db.update(previewPosts).set({ status, updatedAt: now }).where(eq(previewPosts.id, post.id));
    }
    return { id: post.id, title: post.title, caption: post.caption, media_id: post.mediaId, status: post.status, created_at: post.createdAt.toISOString(), updated_at: post.updatedAt.toISOString(), targets: postTargets.map(target => ({ id: target.id, platform: target.platform, status: target.status, attempts: target.attempts, external_id: target.externalId, external_url: target.externalUrl, error: target.error, updated_at: target.updatedAt.toISOString() })) };
  }));
}
