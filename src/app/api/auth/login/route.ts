import { timingSafeEqual } from "node:crypto";

function same(a: string, b: string) {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const user = process.env.ADMIN_USER || "";
    const password = process.env.ADMIN_PASSWORD || "";
    if (!user || !password || !same(String(body.username || ""), user) || !same(String(body.password || ""), password)) {
      return Response.json({ detail: "Invalid username or password. In the hosted preview, use Return to demo workspace." }, { status: 401 });
    }
    return Response.json({ access_token: crypto.randomUUID(), token_type: "bearer" });
  } catch { return Response.json({ detail: "Invalid request" }, { status: 400 }); }
}
