import { isUuid, listPosts } from "@/lib/preview";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ detail: "Post not found" }, { status: 404 });
  const [post] = await listPosts(id);
  return post ? Response.json(post) : Response.json({ detail: "Post not found" }, { status: 404 });
}
