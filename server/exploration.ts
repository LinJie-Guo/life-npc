import { z } from "zod";
import { database, identity, checkOrigin, ApiError, failure } from "./core";
import { quests, roles, cities, dayKey } from "../lib/catalog";
import type { Profile, Run } from "../lib/types";
export const dynamic = "force-dynamic";
const text = (max: number) => z.string().trim().max(max);
const location = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.number().min(0).max(1000000),
  })
  .nullable()
  .optional();
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("profile"),
    name: text(24).min(1),
    role: z.enum(roles as [string, ...string[]]),
    city: z.enum(Object.keys(cities) as [string, ...string[]]),
    answers: z.array(z.number().int().min(0).max(3)).length(6),
  }),
  z.object({ action: z.literal("settings"), discoverable: z.boolean() }),
  z.object({
    action: z.literal("accept"),
    task: z.string(),
    place: text(100).optional(),
  }),
  z.object({ action: z.literal("join"), offer: z.string().uuid() }),
  z.object({
    action: z.literal("draft"),
    run: z.string().uuid(),
    note: text(2000),
    place: text(100),
    location,
  }),
  z.object({
    action: z.literal("complete"),
    run: z.string().uuid(),
    note: text(2000).min(10, "请至少写下 10 个字的真实体验"),
    place: text(100).min(2, "请填写地点名称"),
    location,
    confirmed: z.literal(true),
  }),
  z.object({ action: z.literal("cancel"), run: z.string().uuid() }),
  z.object({
    action: z.literal("favorite"),
    task: z.string(),
    saved: z.boolean(),
  }),
  z.object({ action: z.literal("event_join") }),
  z.object({ action: z.literal("event_claim") }),
]);
async function snapshot(user: string) {
  const db = database();
  await db
    .prepare(
      "UPDATE runs SET status='cancelled' WHERE status='active' AND deadline<=?",
    )
    .bind(Date.now())
    .run();
  const p = await db
    .prepare("SELECT * FROM profiles WHERE id=?")
    .bind(user)
    .first<Profile & { answers: string }>();
  const runs = await db
    .prepare("SELECT * FROM runs WHERE user=? ORDER BY started DESC")
    .bind(user)
    .all();
  const files = await db
    .prepare("SELECT id,run,type,size FROM media WHERE user=?")
    .bind(user)
    .all();
  const fav = await db
    .prepare("SELECT task FROM favorites WHERE user=?")
    .bind(user)
    .all<{ task: string }>();
  const offers = p?.discoverable
    ? await db
        .prepare(
          "SELECT r.id,r.task,r.started,r.invitation AS place,p.name,p.role,p.city FROM runs r JOIN profiles p ON r.user=p.id WHERE r.status='active' AND r.partner IS NULL AND r.task IN ('book','hello') AND p.discoverable=1 AND p.city=? AND r.user<>? AND r.deadline>? ORDER BY r.started DESC LIMIT 30",
        )
        .bind(p.city, user, Date.now())
        .all()
    : { results: [] };
  const encounters = await db
    .prepare(
      "SELECT p.name,p.role,p.city,r.task,r.completed FROM runs r JOIN profiles p ON r.partner=p.id WHERE r.user=? AND r.status='completed' AND EXISTS(SELECT 1 FROM runs other WHERE other.user=r.partner AND other.match_id=r.match_id AND other.status='completed') ORDER BY r.completed DESC",
    )
    .bind(user)
    .all();
  const event = await db
    .prepare("SELECT id,started,completed FROM events WHERE user=?")
    .bind(user)
    .first();
  const count = await db
    .prepare("SELECT count(*) AS count FROM events WHERE started>?")
    .bind(Date.now() - 86400000)
    .first<{ count: number }>();
  const earned = await db
    .prepare(
      "SELECT COALESCE(SUM(amount),0) AS total FROM xp_ledger WHERE user=?",
    )
    .bind(user)
    .first<{ total: number }>();
  return {
    communityXp: Number(earned?.total || 0),
    profile: p ? { ...p, answers: JSON.parse(p.answers) } : null,
    runs: runs.results,
    media: files.results,
    favorites: fav.results.map((f) => f.task),
    offers: offers.results,
    encounters: encounters.results,
    event,
    participants: count?.count || 0,
    now: Date.now(),
  };
}
export async function GET() {
  try {
    return Response.json(await snapshot(await identity()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await identity();
    let raw;
    try {
      raw = await req.json();
    } catch {
      throw new ApiError(400, "请求格式不正确");
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success)
      throw new ApiError(400, parsed.error.issues[0].message);
    const a = parsed.data,
      db = database(),
      now = Date.now();
    await db
      .prepare(
        "UPDATE runs SET status='cancelled' WHERE status='active' AND deadline<=?",
      )
      .bind(now)
      .run();
    const p = await db
      .prepare("SELECT * FROM profiles WHERE id=?")
      .bind(user)
      .first<Profile>();
    if (a.action === "profile") {
      await db
        .prepare(
          "INSERT INTO profiles(id,name,role,city,answers,created) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),role=VALUES(role),city=VALUES(city),answers=VALUES(answers)",
        )
        .bind(user, a.name, a.role, a.city, JSON.stringify(a.answers), now)
        .run();
    } else {
      if (!p) throw new ApiError(409, "请先完成生活扫描");
      if (a.action === "settings") {
        await db
          .prepare("UPDATE profiles SET discoverable=? WHERE id=?")
          .bind(a.discoverable ? 1 : 0, user)
          .run();
      }
      if (a.action === "favorite") {
        if (!quests.some((t) => t.id === a.task))
          throw new ApiError(404, "任务不存在");
        if (a.saved)
          await db
            .prepare("INSERT IGNORE INTO favorites(user,task) VALUES(?,?)")
            .bind(user, a.task)
            .run();
        else
          await db
            .prepare("DELETE FROM favorites WHERE user=? AND task=?")
            .bind(user, a.task)
            .run();
      }
      if (a.action === "accept") {
        const q = quests.find((q) => q.id === a.task);
        if (!q) throw new ApiError(404, "任务不存在");
        if (q.kind === "npc" && (!a.place || a.place.length < 5))
          throw new ApiError(400, "请填写公开地点与时间");
        if (q.kind === "npc" && !p.discoverable)
          throw new ApiError(409, "请先开启同城发现");
        const active = await db
          .prepare("SELECT id FROM runs WHERE user=? AND status='active'")
          .bind(user)
          .first();
        if (active)
          throw new ApiError(409, "先完成或结束当前任务，再开启下一段旅程");
        const today = await db
          .prepare(
            "SELECT id,status FROM runs WHERE user=? AND task=? AND day=? AND status<>'cancelled'",
          )
          .bind(user, q.id, dayKey())
          .first<{ id: string; status: string }>();
        if (today?.status === "completed")
          throw new ApiError(409, "今天已完成这个任务，明天再来探索");
        if (today) {
          await db
            .prepare(
              "UPDATE runs SET status='active',started=?,completed=NULL,note='',place=?,location=NULL,partner=NULL,match_id=? WHERE id=? AND status='cancelled'",
            )
            .bind(
              now,
              a.place || "",
              q.kind === "npc" ? today.id : null,
              today.id,
            )
            .run();
        } else {
          const id = crypto.randomUUID();
          await db
            .prepare(
              "INSERT INTO runs(id,user,task,day,status,started,deadline,note,invitation,match_id) SELECT ?,?,?,?,'active',?,?,'',?,?",
            )
            .bind(
              id,
              user,
              q.id,
              dayKey(),
              now,
              now + 86400000,
              a.place || "",
              q.kind === "npc" ? id : null,
            )
            .run();
        }
      }
      if (a.action === "join") {
        if (!p.discoverable) throw new ApiError(409, "请先开启同城发现");
        const offer = await db
          .prepare(
            "SELECT r.* FROM runs r JOIN profiles p ON p.id=r.user WHERE r.id=? AND r.user<>? AND r.status='active' AND r.partner IS NULL AND p.discoverable=1 AND p.city=? AND r.task IN ('book','hello') AND r.deadline>?",
          )
          .bind(a.offer, user, p.city, now)
          .first<Run>();
        if (!offer) throw new ApiError(409, "邀请已被接受或已结束，请刷新");
        const active = await db
          .prepare("SELECT id FROM runs WHERE user=? AND status='active'")
          .bind(user)
          .first();
        if (active) throw new ApiError(409, "请先完成当前任务");
        const prior = await db
          .prepare(
            "SELECT id FROM runs WHERE user=? AND task=? AND day=? AND status<>'cancelled'",
          )
          .bind(user, offer.task, dayKey())
          .first();
        if (prior) throw new ApiError(409, "今天已参与此任务，请选择另一项");
        const id = crypto.randomUUID();
        await db.batch([
          db
            .prepare(
              "UPDATE runs SET partner=? WHERE id=? AND partner IS NULL AND status='active'",
            )
            .bind(user, offer.id),
          db
            .prepare(
              "INSERT INTO runs(id,user,task,day,status,started,deadline,note,invitation,partner,match_id) SELECT ?,?,?,?,'active',?,?,'',?,?,? WHERE EXISTS(SELECT 1 FROM runs WHERE id=? AND partner=? AND status='active')",
            )
            .bind(
              id,
              user,
              offer.task,
              dayKey(),
              now,
              offer.deadline,
              offer.invitation,
              offer.user,
              offer.id,
              offer.id,
              user,
            ),
        ]);
        const joined = await db
          .prepare("SELECT id FROM runs WHERE id=?")
          .bind(id)
          .first();
        if (!joined)
          throw new ApiError(409, "刚刚有其他玩家接受了邀请，请选择另一位");
      }
      if (["draft", "complete", "cancel"].includes(a.action) && "run" in a) {
        const run = await db
          .prepare("SELECT * FROM runs WHERE id=? AND user=?")
          .bind(a.run, user)
          .first<Run>();
        if (!run) throw new ApiError(404, "任务记录不存在");
        if (a.action === "complete" && run.status === "completed")
          return Response.json(await snapshot(user));
        if (run.status !== "active")
          throw new ApiError(409, "这个任务已经结束");
        if (a.action === "cancel") {
          await db.batch([
            db
              .prepare(
                "UPDATE runs SET status='cancelled',partner=NULL WHERE id=? AND user=? AND status='active'",
              )
              .bind(run.id, user),
            db
              .prepare(
                "UPDATE runs SET partner=NULL,status='cancelled' WHERE match_id=? AND user<>? AND status='active'",
              )
              .bind(run.match_id, user),
          ]);
        }
        if (a.action === "draft" || a.action === "complete") {
          if (
            a.action === "complete" &&
            quests.find((q) => q.id === run.task)?.kind === "npc" &&
            !run.partner
          )
            throw new ApiError(409, "还没有匹配玩家，匹配后再完成真人任务");
          if (a.action === "complete" && run.partner) {
            const partner = await db
              .prepare(
                "SELECT id FROM runs WHERE match_id=? AND user=? AND status IN ('active','completed')",
              )
              .bind(run.match_id, run.partner)
              .first();
            if (!partner)
              throw new ApiError(409, "对方已结束这次邀请，请重新匹配");
          }
          await db
            .prepare(
              "UPDATE runs SET note=?,place=?,location=?,status=?,completed=? WHERE id=? AND user=? AND status='active'",
            )
            .bind(
              a.note,
              a.place,
              a.location ? JSON.stringify(a.location) : null,
              a.action === "complete" ? "completed" : "active",
              a.action === "complete" ? now : null,
              run.id,
              user,
            )
            .run();
        }
      }
      if (a.action === "event_join") {
        await db
          .prepare(
            "INSERT INTO events(id,user,started) VALUES(?,?,?) ON DUPLICATE KEY UPDATE started=IF(events.completed IS NULL AND events.started<?,VALUES(started),events.started)",
          )
          .bind(crypto.randomUUID(), user, now, now - 86400000)
          .run();
      }
      if (a.action === "event_claim") {
        const event = await db
          .prepare("SELECT * FROM events WHERE user=?")
          .bind(user)
          .first<{ started: number; completed: number | null }>();
        if (!event) throw new ApiError(409, "请先加入城市探索计划");
        if (!event.completed) {
          const result = await db
            .prepare(
              "SELECT COUNT(DISTINCT task) AS count FROM runs WHERE user=? AND status='completed' AND task IN ('cafe','park','photo') AND completed>=? AND completed<=?",
            )
            .bind(user, event.started, event.started + 86400000)
            .first<{ count: number }>();
          if ((result?.count || 0) < 3)
            throw new ApiError(409, "完成小店、公园、城市色彩三个任务后再领取");
          await db
            .prepare(
              "UPDATE events SET completed=? WHERE user=? AND completed IS NULL",
            )
            .bind(now, user)
            .run();
        }
      }
    }
    return Response.json(await snapshot(user), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
