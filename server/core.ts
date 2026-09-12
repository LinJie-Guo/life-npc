import { AsyncLocalStorage } from "node:async_hooks";
import { one, execute } from "./db";
export { database } from "./db";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const requestContext = new AsyncLocalStorage<{ user: string | null }>();
export async function identity() {
  const user = requestContext.getStore()?.user;
  if (!user) throw new ApiError(401, "请先注册或登录");
  return user;
}
export function checkOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  const allowed = (
    process.env.APP_ORIGINS ||
    "http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:8788"
  ).split(",");
  if (!origin || !allowed.includes(origin))
    throw new ApiError(403, "请求来源不匹配，请刷新后重试");
}
export function failure(e: unknown) {
  if (e instanceof ApiError)
    return Response.json({ error: e.message }, { status: e.status });
  const code = (e as { code?: string })?.code;
  if (
    ["ER_DUP_ENTRY", "ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(
      code || "",
    )
  )
    return Response.json(
      { error: "状态刚刚发生变化，请刷新后重试" },
      { status: 409 },
    );
  console.error(
    "API error:",
    code || (e instanceof Error ? e.message : "unknown"),
  );
  return Response.json(
    { error: "服务暂时不可用，请稍后重试" },
    { status: 500 },
  );
}
export function bucket() {
  return {
    async put(id: string, bytes: ArrayBuffer) {
      await execute("INSERT INTO media_objects(id,bytes) VALUES(?,?)", [
        id,
        Buffer.from(bytes),
      ]);
    },
    async get(id: string) {
      const r = await one<{ bytes: Buffer }>(
        "SELECT bytes FROM media_objects WHERE id=?",
        [id],
      );
      return r ? { body: new Uint8Array(r.bytes) } : null;
    },
    async delete(id: string) {
      await execute("DELETE FROM media_objects WHERE id=?", [id]);
    },
  };
}
