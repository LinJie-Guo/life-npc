import { randomUUID } from "node:crypto";
import { z } from "zod";
import { one, rows, execute, transaction } from "./db";
import { ApiError, identity } from "./core";
import { quests } from "../lib/catalog";
import type { CommunityTask, Participation } from "../lib/community-types";
const fields = {
  title: z.string().trim().min(4, "标题至少 4 个字").max(60),
  description: z.string().trim().min(10, "描述至少 10 个字").max(2000),
  requirements: z.string().trim().min(5, "请写明完成要求").max(1000),
  category: z.enum([
    "城市探索",
    "生活体验",
    "运动户外",
    "读书交流",
    "公益行动",
  ]),
  city: z.string().trim().min(1).max(24),
  place: z.string().trim().min(2, "请填写公开活动地点").max(100),
  deadline: z.number().int(),
  capacity: z.number().int().min(1).max(100),
};
const createSchema = z.object({
  ...fields,
  action: z.enum(["draft", "publish"]),
});
const updateSchema = z.discriminatedUnion("action", [
  z.object({ ...fields, action: z.literal("edit") }),
  z.object({ action: z.literal("publish") }),
  z.object({ action: z.literal("join") }),
  z.object({ action: z.literal("withdraw") }),
  z.object({
    action: z.literal("draft_submission"),
    note: z.string().trim().max(2000),
  }),
  z.object({
    action: z.literal("submit"),
    note: z.string().trim().min(10, "请至少写 10 个字的完成记录").max(2000),
    confirmed: z.literal(true),
  }),
  z.object({
    action: z.literal("review"),
    participation: z.string().uuid(),
    decision: z.enum(["approved", "rejected"]),
    feedback: z.string().trim().max(500),
  }),
  z.object({ action: z.literal("close") }),
  z.object({
    action: z.literal("cancel"),
    reason: z.string().trim().min(5, "请说明取消原因（至少 5 个字）").max(300),
  }),
]);
const select = `SELECT t.*,p.name owner_name,
 (SELECT COUNT(*) FROM participations WHERE task=t.id AND status NOT IN ('withdrawn','cancelled')) joined_count,
 (SELECT COUNT(*) FROM participations WHERE task=t.id AND status='approved') approved_count,
 (SELECT COUNT(*) FROM participations WHERE task=t.id AND status='submitted') pending_count,
 mine.id my_id,mine.status my_status
 FROM community_tasks t JOIN profiles p ON p.id=t.owner LEFT JOIN participations mine ON mine.task=t.id AND mine.user=?`;
async function history(
  task: string,
  actor: string | null,
  action: string,
  detail = "",
  participation: string | null = null,
) {
  await execute(
    "INSERT INTO task_history(id,task,actor,participation,action,detail,created) VALUES(?,?,?,?,?,?,?)",
    [randomUUID(), task, actor, participation, action, detail, Date.now()],
  );
}
// Called while holding the task row lock; no cron is needed for correctness at the deadline.
async function expire(t: CommunityTask) {
  if (!["open", "closed"].includes(t.status) || t.deadline > Date.now()) return;
  await execute(
    "UPDATE participations SET status='expired' WHERE task=? AND status IN ('joined','rejected')",
    [t.id],
  );
  if (t.status === "open")
    await history(t.id, null, "deadline", "任务已到截止时间");
  const pending = await one(
    "SELECT id FROM participations WHERE task=? AND status='submitted' LIMIT 1",
    [t.id],
  );
  t.status = pending ? "closed" : "finished";
  await execute("UPDATE community_tasks SET status=?,updated=? WHERE id=?", [
    t.status,
    Date.now(),
    t.id,
  ]);
}
export async function settleDue() {
  const due = await rows<{ id: string }>(
    "SELECT id FROM community_tasks WHERE status IN ('open','closed') AND deadline<=? AND (status='open' OR NOT EXISTS(SELECT 1 FROM participations p WHERE p.task=community_tasks.id AND p.status='submitted') OR EXISTS(SELECT 1 FROM participations p WHERE p.task=community_tasks.id AND p.status IN ('joined','rejected'))) ORDER BY deadline LIMIT 100",
    [Date.now()],
  );
  for (const t of due)
    await transaction(async () => {
      const locked = await one<CommunityTask>(
        "SELECT * FROM community_tasks WHERE id=? FOR UPDATE",
        [t.id],
      );
      if (locked) await expire(locked);
    });
}
async function detail(id: string, user: string) {
  const task = await one<CommunityTask>(select + " WHERE t.id=?", [user, id]);
  if (!task || (task.status === "draft" && task.owner !== user))
    throw new ApiError(404, "任务不存在");
  const owner = task.owner === user;
  const participations = await rows<Participation>(
    `SELECT r.*,p.name FROM participations r JOIN profiles p ON p.id=r.user WHERE r.task=? ${owner ? "" : "AND r.user=?"} ORDER BY r.joined`,
    owner ? [id] : [id, user],
  );
  const attachments = await rows(
    `SELECT m.id,m.run,m.type,m.size FROM media m JOIN participations r ON r.id=m.run WHERE r.task=? ${owner ? "" : "AND r.user=?"}`,
    owner ? [id] : [id, user],
  );
  // Submission and review details remain private to the author and the respective participant.
  const events = await rows(
    `SELECT id,action,detail,created FROM task_history WHERE task=? ${owner ? "" : "AND (participation IS NULL OR actor=? OR participation IN (SELECT id FROM participations WHERE task=? AND user=?))"} ORDER BY created DESC LIMIT 50`,
    owner ? [id] : [id, user, id, user],
  );
  return {
    task,
    participations: participations.map((p) =>
      owner && !["submitted", "approved", "rejected"].includes(p.status)
        ? { ...p, note: "" }
        : p,
    ),
    attachments: owner
      ? attachments.filter((m) =>
          participations.some(
            (p) =>
              p.id === (m as { run: string }).run &&
              ["submitted", "approved", "rejected"].includes(p.status),
          ),
        )
      : attachments,
    history: events,
  };
}
export async function community(req: Request, id?: string) {
  const user = await identity();
  if (id && !z.string().uuid().safeParse(id).success)
    throw new ApiError(404, "任务不存在");
  await settleDue();
  if (req.method === "GET") {
    if (id) return Response.json(await detail(id, user));
    const profile = await one(
      "SELECT p.id,p.name,p.city,p.role,a.username FROM profiles p JOIN accounts a ON a.id=p.id WHERE p.id=?",
      [user],
    );
    const tasks = await rows<CommunityTask>(
      select +
        " WHERE t.status<>'draft' OR t.owner=? ORDER BY t.created DESC LIMIT 500",
      [user, user],
    );
    const xpCommunity = await one<{ total: number }>(
      "SELECT COALESCE(SUM(amount),0) total FROM xp_ledger WHERE user=?",
      [user],
    );
    const runs = await rows<{ task: string }>(
      "SELECT task FROM runs WHERE user=? AND status='completed'",
      [user],
    );
    const event = await one<{ completed: number | null }>(
      "SELECT completed FROM events WHERE user=?",
      [user],
    );
    const stats = await one<{ joined: number; approved: number }>(
      "SELECT COALESCE(SUM(status IN ('joined','submitted','rejected')),0) joined,COALESCE(SUM(status='approved'),0) approved FROM participations WHERE user=?",
      [user],
    );
    const publisher = await one<{ published: number; pending: number }>(
      "SELECT COUNT(DISTINCT t.id) published,COUNT(CASE WHEN p.status='submitted' THEN p.id END) pending FROM community_tasks t LEFT JOIN participations p ON p.task=t.id WHERE t.owner=? AND t.status<>'draft'",
      [user],
    );
    return Response.json({
      user: profile,
      tasks,
      xp:
        Number(xpCommunity?.total || 0) +
        runs.reduce(
          (s, r) => s + (quests.find((q) => q.id === r.task)?.xp || 0),
          0,
        ) +
        (event?.completed ? 50 : 0),
      stats: { ...stats, ...publisher },
      now: Date.now(),
    });
  }
  if (req.method !== "POST") throw new ApiError(405, "不支持的请求方式");
  const raw = await req.json().catch(() => {
    throw new ApiError(400, "请求格式不正确");
  });
  if (!id) {
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success)
      throw new ApiError(400, parsed.error.issues[0].message);
    const a = parsed.data;
    validateDeadline(a.deadline);
    const newId = randomUUID(),
      now = Date.now();
    await transaction(async () => {
      // Serialize per-publisher quota, including concurrent requests.
      await one("SELECT id FROM accounts WHERE id=? FOR UPDATE", [user]);
      const count = await one<{ n: number }>(
        "SELECT COUNT(*) n FROM community_tasks WHERE owner=? AND status IN ('draft','open')",
        [user],
      );
      if ((count?.n || 0) >= 20)
        throw new ApiError(
          409,
          "最多保留 20 个草稿或招募中的任务，请先结束已有任务",
        );
      await execute(
        "INSERT INTO community_tasks(id,owner,title,description,requirements,category,city,place,deadline,capacity,reward,status,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          newId,
          user,
          a.title,
          a.description,
          a.requirements,
          a.category,
          a.city,
          a.place,
          a.deadline,
          a.capacity,
          20,
          a.action === "draft" ? "draft" : "open",
          now,
          now,
        ],
      );
      await history(newId, user, a.action === "draft" ? "draft" : "publish");
    });
    return Response.json(await detail(newId, user), { status: 201 });
  }
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
  const a = parsed.data;
  await transaction(async () => {
    const t = await one<CommunityTask>(
      "SELECT * FROM community_tasks WHERE id=? FOR UPDATE",
      [id],
    );
    if (!t || (t.status === "draft" && t.owner !== user))
      throw new ApiError(404, "任务不存在");
    await expire(t);
    const now = Date.now();
    const owner = () => {
      if (t.owner !== user)
        throw new ApiError(403, "只有发布者可以管理这个任务");
    };
    if (a.action === "edit") {
      owner();
      if (t.status !== "draft")
        throw new ApiError(409, "发布后不能更改要求，请复制为新任务");
      validateDeadline(a.deadline);
      await execute(
        "UPDATE community_tasks SET title=?,description=?,requirements=?,category=?,city=?,place=?,deadline=?,capacity=?,updated=? WHERE id=?",
        [
          a.title,
          a.description,
          a.requirements,
          a.category,
          a.city,
          a.place,
          a.deadline,
          a.capacity,
          now,
          id,
        ],
      );
      await history(id, user, "edit");
      return;
    }
    if (a.action === "publish") {
      owner();
      if (t.status !== "draft") throw new ApiError(409, "任务已发布或结束");
      validateDeadline(t.deadline);
      await execute(
        "UPDATE community_tasks SET status='open',updated=? WHERE id=?",
        [now, id],
      );
      await history(id, user, "publish");
      return;
    }
    if (a.action === "close") {
      owner();
      if (t.status !== "open") throw new ApiError(409, "任务已经停止招募");
      await execute(
        "UPDATE community_tasks SET status='closed',updated=? WHERE id=?",
        [now, id],
      );
      await history(
        id,
        user,
        "close",
        "停止接受新报名，已有参与者仍可在截止前提交",
      );
      return;
    }
    if (a.action === "cancel") {
      owner();
      if (t.status === "cancelled") return;
      if (t.status === "finished")
        throw new ApiError(409, "任务已结束，完成记录已归档");
      if (
        await one(
          "SELECT id FROM participations WHERE task=? AND status='submitted' LIMIT 1",
          [id],
        )
      )
        throw new ApiError(409, "请先验收待审核记录，再取消任务");
      await execute(
        "UPDATE community_tasks SET status='cancelled',cancel_reason=?,updated=? WHERE id=?",
        [a.reason, now, id],
      );
      await execute(
        "UPDATE participations SET status='cancelled' WHERE task=? AND status IN ('joined','rejected')",
        [id],
      );
      await history(id, user, "cancel", a.reason);
      return;
    }
    if (a.action === "review") {
      owner();
      const p = await one<Participation>(
        "SELECT * FROM participations WHERE id=? AND task=? FOR UPDATE",
        [a.participation, id],
      );
      if (!p) throw new ApiError(404, "参与记录不存在");
      if (p.status === a.decision) return;
      if (p.status !== "submitted")
        throw new ApiError(409, "只能验收待审核的记录");
      if (a.decision === "rejected" && a.feedback.length < 5)
        throw new ApiError(400, "请说明需要补充的内容（至少 5 个字）");
      await execute(
        "UPDATE participations SET status=?,feedback=?,reviewed=? WHERE id=?",
        [a.decision, a.feedback, now, p.id],
      );
      if (a.decision === "approved")
        await execute(
          "INSERT INTO xp_ledger(id,user,participation,amount,created) VALUES(?,?,?,?,?)",
          [randomUUID(), p.user, p.id, t.reward, now],
        );
      await history(id, user, a.decision, a.feedback, p.id);
      await expire(t);
      return;
    }
    if (t.owner === user) throw new ApiError(409, "发布者不能报名自己的任务");
    const p = await one<Participation>(
      "SELECT * FROM participations WHERE task=? AND user=? FOR UPDATE",
      [id, user],
    );
    if (a.action === "join") {
      if (t.status !== "open" || t.deadline <= now)
        throw new ApiError(409, "报名已经结束");
      if (p && p.status !== "withdrawn")
        throw new ApiError(409, "你已参与过这个任务");
      const n = await one<{ n: number }>(
        "SELECT COUNT(*) n FROM participations WHERE task=? AND status NOT IN ('withdrawn','cancelled')",
        [id],
      );
      if ((n?.n || 0) >= t.capacity)
        throw new ApiError(409, "名额已满，看看其他任务吧");
      if (p)
        await execute(
          "UPDATE participations SET status='joined',joined=? WHERE id=?",
          [now, p.id],
        );
      else
        await execute(
          "INSERT INTO participations(id,task,user,status,note,joined) VALUES(?,?,?,'joined','',?)",
          [randomUUID(), id, user, now],
        );
      await history(id, user, "join");
      return;
    }
    if (!p) throw new ApiError(409, "请先报名任务");
    if (a.action === "withdraw") {
      if (!["joined", "rejected"].includes(p.status))
        throw new ApiError(409, "提交后不能退出，请联系发布者验收");
      await execute("UPDATE participations SET status='withdrawn' WHERE id=?", [
        p.id,
      ]);
      await history(id, user, "withdraw");
      return;
    }
    if (t.status === "cancelled" || t.deadline <= now)
      throw new ApiError(409, "任务已截止，不能再提交或修改");
    if (!["joined", "rejected"].includes(p.status))
      throw new ApiError(409, "这份记录已提交，请等待验收");
    if (a.action === "draft_submission") {
      await execute("UPDATE participations SET note=? WHERE id=?", [
        a.note,
        p.id,
      ]);
      return;
    }
    if (a.action === "submit") {
      await execute(
        "UPDATE participations SET status='submitted',note=?,submitted=?,feedback='' WHERE id=?",
        [a.note, now, p.id],
      );
      await history(id, user, "submit", "已提交完成记录", p.id);
    }
  });
  return Response.json(await detail(id, user));
}
function validateDeadline(deadline: number) {
  if (deadline < Date.now() + 60000 || deadline > Date.now() + 90 * 86400000)
    throw new ApiError(400, "截止时间需在 1 分钟后、90 天内");
}
