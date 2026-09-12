import { env } from "cloudflare:workers";
// Sites is an optional UI gateway. The independent Node service owns identity and MySQL data.
export async function forward(req: Request) {
  const config = env as unknown as Record<string, string>;
  if (!config.API_BASE_URL)
    return Response.json(
      { error: "业务服务尚未连接，请配置 API_BASE_URL" },
      { status: 503 },
    );
  const original = new URL(req.url),
    target = new URL(original.pathname + original.search, config.API_BASE_URL);
  const origin = req.headers.get("origin");
  if (!["GET", "HEAD"].includes(req.method) && origin !== original.origin)
    return Response.json({ error: "请求来源不匹配" }, { status: 403 });
  const headers = new Headers();
  for (const name of ["content-type", "cookie"]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (origin) headers.set("origin", origin);
  if (config.API_PROXY_SECRET)
    headers.set("x-npc-proxy-secret", config.API_PROXY_SECRET);
  try {
    const result = await fetch(target, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method)
        ? undefined
        : await req.arrayBuffer(),
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    const out = new Headers();
    for (const name of ["content-type", "set-cookie"]) {
      const value = result.headers.get(name);
      if (value) out.set(name, value);
    }
    out.set("Cache-Control", "private, no-store");
    out.set("X-Content-Type-Options", "nosniff");
    return new Response(result.body, { status: result.status, headers: out });
  } catch {
    return Response.json(
      { error: "暂时无法连接业务服务，请稍后重试" },
      { status: 503 },
    );
  }
}
