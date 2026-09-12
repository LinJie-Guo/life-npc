import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { timingSafeEqual } from "node:crypto";
import { auth, sessionUser } from "./auth";
import { community, settleDue } from "./community";
import * as exploration from "./exploration";
import * as media from "./media";
import {
  requestContext,
  identity,
  checkOrigin,
  failure,
  ApiError,
} from "./core";
import { one, execute, pool, transaction } from "./db";
const port = Number(process.env.API_PORT || 8788),
  host = process.env.API_HOST || "127.0.0.1";
const staticRoot = resolve("dist-app");
if (!process.env.MYSQL_URL) throw new Error("MYSQL_URL must be configured");
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.APP_ORIGINS || process.env.COOKIE_SECURE !== "true")
)
  throw new Error("Production requires APP_ORIGINS and COOKIE_SECURE=true");
async function dispatch(req: Request, ip: string) {
  const path = new URL(req.url).pathname;
  checkOrigin(req);
  if (path === "/api/health") {
    await one("SELECT 1 ok");
    return Response.json({ ok: true, database: "mysql" });
  }
  const secret = process.env.API_PROXY_SECRET;
  if (secret && path.startsWith("/api/")) {
    const got = req.headers.get("x-npc-proxy-secret") || "";
    if (
      got.length !== secret.length ||
      !timingSafeEqual(Buffer.from(got), Buffer.from(secret))
    )
      throw new ApiError(403, "请求未授权");
  }
  const user = await sessionUser(req);
  return requestContext.run({ user }, async () => {
    if (path.startsWith("/api/auth/")) return auth(req, path.slice(10), ip);
    if (path === "/api/community" || path.startsWith("/api/community/"))
      return community(req, path.slice(15) || undefined);
    if (path === "/api/game") {
      const actor = await identity();
      return transaction(async () => {
        await one("SELECT id FROM accounts WHERE id=? FOR UPDATE", [actor]);
        const r = await (req.method === "GET"
          ? exploration.GET()
          : req.method === "POST"
            ? exploration.POST(req)
            : Promise.resolve(
                Response.json({ error: "不支持的请求方式" }, { status: 405 }),
              ));
        if (r.status >= 400)
          throw new ApiError(
            r.status,
            ((await r.json()) as { error: string }).error,
          );
        return r;
      });
    }
    if (path === "/api/media") {
      const actor = await identity();
      return transaction(async () => {
        await one("SELECT id FROM accounts WHERE id=? FOR UPDATE", [actor]);
        if (req.method === "POST") {
          const form = await req.clone().formData();
          const run = form.get("run");
          if (typeof run === "string") {
            const p = await one<{ task: string }>(
              "SELECT task FROM participations WHERE id=?",
              [run],
            );
            if (p)
              await one(
                "SELECT id FROM community_tasks WHERE id=? FOR UPDATE",
                [p.task],
              );
          }
        }
        const r = await (req.method === "GET"
          ? media.GET(req)
          : req.method === "POST"
            ? media.POST(req)
            : Promise.resolve(
                Response.json({ error: "不支持的请求方式" }, { status: 405 }),
              ));
        if (r.status >= 400)
          throw new ApiError(
            r.status,
            ((await r.json()) as { error: string }).error,
          );
        return r;
      });
    }
    if (path === "/api/map-config")
      return Response.json({
        key: process.env.AMAP_JS_KEY || null,
        enabled: !!process.env.AMAP_JS_KEY && !!process.env.AMAP_SECURITY_CODE,
      });
    if (path.startsWith("/_AMapService/")) {
      await identity();
      if (!process.env.AMAP_JS_KEY || !process.env.AMAP_SECURITY_CODE)
        throw new ApiError(503, "地图服务尚未配置");
      const part = path.slice("/_AMapService/".length);
      if (!/^(v3|v4|v5)\//.test(part) || part.includes(".."))
        throw new ApiError(400, "不支持的地图请求");
      const target = new URL(
        "/" + part,
        part === "v4/map/styles"
          ? "https://webapi.amap.com"
          : "https://restapi.amap.com",
      );
      target.search = new URL(req.url).search;
      target.searchParams.set("jscode", process.env.AMAP_SECURITY_CODE);
      target.searchParams.set("key", process.env.AMAP_JS_KEY);
      const res = await fetch(target, { signal: AbortSignal.timeout(10000) });
      return new Response(res.body, {
        status: res.status,
        headers: {
          "Content-Type": res.headers.get("Content-Type") || "application/json",
        },
      });
    }
    if (path.startsWith("/api/")) throw new ApiError(404, "接口不存在");
    if (req.method !== "GET") throw new ApiError(405, "不支持的请求方式");
    const candidate = resolve(staticRoot, "." + decodeURIComponent(path));
    if (!candidate.startsWith(staticRoot + sep)) {
      if (path !== "/") throw new ApiError(404, "页面不存在");
    }
    const file = extname(candidate)
      ? candidate
      : resolve(staticRoot, "index.html");
    const content = await readFile(file).catch(() => {
      throw new ApiError(404, "页面不存在");
    });
    const types: Record<string, string> = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".webmanifest": "application/manifest+json",
    };
    return new Response(content, {
      headers: {
        "Content-Type": types[extname(file)] || "application/octet-stream",
      },
    });
  });
}
const server = createServer(async (incoming, out) => {
  try {
    let size = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) {
      size += chunk.length;
      if (size > 6 * 1024 * 1024) throw new ApiError(413, "请求不能超过 6 MB");
      chunks.push(chunk);
    }
    const url = new URL(incoming.url || "/", `http://127.0.0.1:${port}`);
    const req = new Request(url, {
      method: incoming.method,
      headers: incoming.headers as Record<string, string>,
      body: ["GET", "HEAD"].includes(incoming.method || "GET")
        ? undefined
        : Buffer.concat(chunks),
    });
    const res = await dispatch(
      req,
      incoming.socket.remoteAddress || "unknown",
    ).catch(failure);
    out.statusCode = res.status;
    res.headers.forEach((v, k) => out.setHeader(k, v));
    out.setHeader("X-Content-Type-Options", "nosniff");
    out.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (url.pathname.startsWith("/api/"))
      out.setHeader("Cache-Control", "no-store");
    if (res.body)
      Readable.fromWeb(
        res.body as import("node:stream/web").ReadableStream,
      ).pipe(out);
    else out.end();
  } catch (e) {
    const res = failure(e);
    out.writeHead(res.status, { "Content-Type": "application/json" });
    out.end(await res.text());
  }
});
server.requestTimeout = 30000;
server.listen(port, host, () =>
  console.log(`Life NPC API http://${host}:${port}`),
);
const timer = setInterval(() => {
  void settleDue()
    .then(() => execute("DELETE FROM sessions WHERE expires<?", [Date.now()]))
    .then(() =>
      execute("DELETE FROM auth_limits WHERE expires<?", [Date.now()]),
    )
    .catch((e) => console.error("Maintenance failed", e.message));
}, 60000);
timer.unref();
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    clearInterval(timer);
    server.close(() => {
      void pool.end().then(() => process.exit(0));
    });
  });
