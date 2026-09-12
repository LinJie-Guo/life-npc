import {
  randomBytes,
  randomUUID,
  createHash,
  scrypt as scryptCb,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { one, execute, transaction } from "./db";
import { ApiError, identity } from "./core";
const scrypt = promisify(scryptCb);
export const digest = (v: string) =>
  createHash("sha256").update(v).digest("hex");
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return salt + ":" + hash.toString("hex");
}
async function verify(password: string, encoded: string) {
  const [salt, hash] = encoded.split(":");
  const result = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return result.length === expected.length && timingSafeEqual(result, expected);
}
const password = z
  .string()
  .min(10, "密码至少 10 位")
  .max(128, "密码不能超过 128 位");
const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{4,32}$/, "账号需为 4–32 位英文字母、数字或下划线");
const register = z.object({
  username,
  password,
  name: z.string().trim().min(1).max(24),
  city: z.string().trim().min(1).max(24),
});
function parse<T>(schema: z.ZodType<T>, data: unknown) {
  const r = schema.safeParse(data);
  if (!r.success) throw new ApiError(400, r.error.issues[0].message);
  return r.data;
}
const cookieName = "npc_session";
export async function sessionUser(req: Request) {
  const value = req.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
  if (!value || !/^[a-f0-9]{64}$/.test(value)) return null;
  return (
    (
      await one<{ user: string }>(
        "SELECT user FROM sessions WHERE token_hash=? AND expires>?",
        [digest(value), Date.now()],
      )
    )?.user || null
  );
}
function sessionCookie(value: string, seconds: number) {
  return `${cookieName}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${seconds}${process.env.COOKIE_SECURE === "true" ? "; Secure" : ""}`;
}
async function loginResponse(
  user: string,
  extra: Record<string, unknown> = {},
) {
  const token = randomBytes(32).toString("hex");
  await execute("INSERT INTO sessions(token_hash,user,expires) VALUES(?,?,?)", [
    digest(token),
    user,
    Date.now() + 7 * 86400000,
  ]);
  return Response.json(
    { ok: true, ...extra },
    {
      headers: {
        "Set-Cookie": sessionCookie(token, 604800),
        "Cache-Control": "no-store",
      },
    },
  );
}
export async function auth(req: Request, path: string, ip: string) {
  if (req.method === "GET" && path === "me") {
    const user = await identity();
    return Response.json(
      await one(
        "SELECT a.username,p.name,p.city FROM accounts a JOIN profiles p ON p.id=a.id WHERE a.id=?",
        [user],
      ),
    );
  }
  if (req.method !== "POST") throw new ApiError(405, "不支持的请求方式");
  const raw = (await req.json().catch(() => {
    throw new ApiError(400, "请求格式不正确");
  })) as Record<string, unknown>;
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new ApiError(400, "请求格式不正确");
  if (path === "logout") {
    const token = req.headers
      .get("cookie")
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1);
    if (token)
      await execute("DELETE FROM sessions WHERE token_hash=?", [digest(token)]);
    return Response.json(
      { ok: true },
      { headers: { "Set-Cookie": sessionCookie("", 0) } },
    );
  }
  if (!["register", "login", "recover", "password"].includes(path))
    throw new ApiError(404, "接口不存在");
  // Persistent limits work across restarts and multiple server instances. Separate account and IP budgets.
  for (const [key, limit] of [
    [`ip:${ip}`, 40],
    [`account:${String(raw.username || "").toLowerCase()}`, 12],
  ] as const) {
    const bucket = digest(key + ":" + Math.floor(Date.now() / 900000));
    await execute(
      "INSERT INTO auth_limits(bucket,hits,expires) VALUES(?,1,?) ON DUPLICATE KEY UPDATE hits=hits+1",
      [bucket, Date.now() + 900000],
    );
    if (
      (await one<{ hits: number }>(
        "SELECT hits FROM auth_limits WHERE bucket=?",
        [bucket],
      ))!.hits > limit
    )
      throw new ApiError(429, "尝试次数过多，请 15 分钟后重试");
  }
  if (path === "register") {
    const a = parse(register, raw);
    const id = randomUUID(),
      recoveryCode = randomBytes(24).toString("hex"),
      passwordHash = await hashPassword(a.password);
    await transaction(async () => {
      if (await one("SELECT id FROM accounts WHERE username=?", [a.username]))
        throw new ApiError(409, "该账号已被使用");
      await execute(
        "INSERT INTO accounts(id,username,password_hash,recovery_hash,created) VALUES(?,?,?,?,?)",
        [id, a.username, passwordHash, digest(recoveryCode), Date.now()],
      );
      await execute(
        "INSERT INTO profiles(id,name,role,city,answers,created) VALUES(?,?,?,?,?,?)",
        [id, a.name, "其他", a.city, "[1,1,1,1,1,1]", Date.now()],
      );
    });
    return loginResponse(id, { recoveryCode });
  }
  if (path === "login") {
    const a = parse(z.object({ username, password: z.string().max(128) }), raw);
    const account = await one<{ id: string; password_hash: string }>(
      "SELECT id,password_hash FROM accounts WHERE username=?",
      [a.username],
    );
    const encoded =
      account?.password_hash ||
      "00000000000000000000000000000000:" + "00".repeat(64);
    if (!(await verify(a.password, encoded)) || !account)
      throw new ApiError(401, "账号或密码不正确");
    return loginResponse(account.id);
  }
  if (path === "recover") {
    const a = parse(
      z.object({
        username,
        password,
        recoveryCode: z.string().regex(/^[a-f0-9]{48}$/, "恢复码格式不正确"),
      }),
      raw,
    );
    const nextCode = randomBytes(24).toString("hex"),
      passwordHash = await hashPassword(a.password);
    await transaction(async () => {
      const account = await one<{ id: string; recovery_hash: string }>(
        "SELECT id,recovery_hash FROM accounts WHERE username=? FOR UPDATE",
        [a.username],
      );
      if (
        !account ||
        !timingSafeEqual(
          Buffer.from(digest(a.recoveryCode)),
          Buffer.from(account.recovery_hash),
        )
      )
        throw new ApiError(400, "账号或恢复码不正确");
      await execute(
        "UPDATE accounts SET password_hash=?,recovery_hash=? WHERE id=?",
        [passwordHash, digest(nextCode), account.id],
      );
      await execute("DELETE FROM sessions WHERE user=?", [account.id]);
    });
    return Response.json(
      { ok: true, recoveryCode: nextCode },
      { headers: { "Set-Cookie": sessionCookie("", 0) } },
    );
  }
  const user = await identity(),
    a = parse(
      z.object({ currentPassword: z.string().max(128), password }),
      raw,
    );
  const passwordHash = await hashPassword(a.password);
  await transaction(async () => {
    const account = await one<{ password_hash: string }>(
      "SELECT password_hash FROM accounts WHERE id=? FOR UPDATE",
      [user],
    );
    if (!account || !(await verify(a.currentPassword, account.password_hash)))
      throw new ApiError(400, "当前密码不正确");
    await execute("UPDATE accounts SET password_hash=? WHERE id=?", [
      passwordHash,
      user,
    ]);
    await execute("DELETE FROM sessions WHERE user=?", [user]);
  });
  return loginResponse(user);
}
