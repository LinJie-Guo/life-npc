import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { pool, execute, one } from "../server/db";
import type { CommunityState, TaskDetail } from "../lib/community-types";
const base = "http://127.0.0.1:8788",
  origin = base;
const results: { name: string; passed: boolean }[] = [];
function ok(name: string, test: unknown) {
  assert.ok(test, name);
  results.push({ name, passed: true });
  console.log("PASS", name);
}
const suffix = Date.now().toString(36),
  password = "TestOnly_Npc_" + randomUUID();
type Client = { username: string; cookie: string; recoveryCode: string };
async function call<T = Record<string, unknown>>(
  client: Client | null,
  path: string,
  body?: unknown,
  expected = path === "community" && body ? 201 : 200,
): Promise<T> {
  const r = await fetch(base + "/api/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      origin,
      ...(client ? { cookie: client.cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  assert.equal(
    r.status,
    expected,
    `${path} ${JSON.stringify(body)}: ${JSON.stringify(data)}`,
  );
  return data as T;
}
async function register(label: string) {
  const username = "qa_" + label + "_" + suffix;
  const r = await fetch(base + "/api/auth/register", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      password,
      name: "测试" + label,
      city: "上海",
    }),
  });
  assert.equal(r.status, 200);
  const data = (await r.json()) as { recoveryCode: string };
  return {
    username,
    cookie: r.headers.get("set-cookie")!.split(";")[0],
    recoveryCode: data.recoveryCode,
  };
}
const template = {
  title: "测试：周末街区观察任务",
  description: "这是自动化测试使用的任务，请在公开街区观察三种城市颜色。",
  requirements: "提交至少十个字的观察笔记，可以上传图片。",
  category: "城市探索",
  city: "上海",
  place: "测试公共公园",
  deadline: Date.now() + 86400000,
  capacity: 2,
  action: "publish",
};
try {
  await call(null, "community", undefined, 401);
  ok("Anonymous access rejected", true);
  const a = await register("publisher"),
    b = await register("one"),
    c = await register("two"),
    d = await register("three");
  ok(
    "Registration creates MySQL account and HttpOnly session",
    !!a.cookie && a.recoveryCode.length === 48,
  );
  await call(
    null,
    "auth/register",
    { username: a.username, password, name: "重复", city: "上海" },
    409,
  );
  ok("Duplicate account rejected", true);
  await call(
    null,
    "auth/login",
    { username: a.username, password: "wrong" },
    401,
  );
  ok("Invalid login rejected", true);
  const account = await one<{ password_hash: string }>(
    "SELECT password_hash FROM accounts WHERE username=?",
    [a.username],
  );
  ok(
    "Password stored as salted hash",
    account?.password_hash !== password && account?.password_hash.includes(":"),
  );
  const draft = await call<TaskDetail>(a, "community", {
    ...template,
    action: "draft",
  });
  await call(b, "community/" + draft.task.id, undefined, 404);
  ok("Draft is private", true);
  await call(a, "community/" + draft.task.id, {
    ...template,
    title: "测试：编辑后的任务草稿",
    action: "edit",
  });
  const published = await call<TaskDetail>(a, "community/" + draft.task.id, {
    action: "publish",
  });
  ok("Draft edit and publish lifecycle", published.task.status === "open");
  await call(a, "community/" + draft.task.id, { action: "join" }, 409);
  ok("Publisher cannot award themselves XP", true);
  await call(b, "community/" + draft.task.id, { action: "close" }, 403);
  ok("Only owner may manage task", true);
  const task = await call<TaskDetail>(a, "community", {
    ...template,
    capacity: 1,
  });
  const joins = await Promise.all(
    [b, c, d].map(async (who) => ({
      who,
      response: await fetch(base + "/api/community/" + task.task.id, {
        method: "POST",
        headers: {
          origin,
          cookie: who.cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "join" }),
      }),
    })),
  );
  ok(
    "Concurrent last-slot signup: exactly one winner",
    joins.filter((j) => j.response.status === 200).length === 1 &&
      joins.filter((j) => j.response.status === 409).length === 2,
  );
  const winner = joins.find((j) => j.response.status === 200)!.who;
  await call(winner, "community/" + task.task.id, { action: "join" }, 409);
  ok("Duplicate participation rejected", true);
  await call(winner, "community/" + task.task.id, { action: "withdraw" });
  const joined = await call<TaskDetail>(winner, "community/" + task.task.id, {
    action: "join",
  });
  ok(
    "Withdraw releases slot and supports rejoin",
    joined.task.joined_count === 1,
  );
  const mine = joined.participations[0];
  await call(winner, "community/" + task.task.id, {
    action: "draft_submission",
    note: "这是一份尚未提交的私人测试草稿。",
  });
  const ownerDraft = await call<TaskDetail>(a, "community/" + task.task.id);
  ok(
    "Unsubmitted draft hidden from publisher",
    ownerDraft.participations[0].note === "",
  );
  const form = new FormData();
  form.set("run", mine.id);
  form.set(
    "file",
    new File(
      [
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1cAAAAASUVORK5CYII=",
          "base64",
        ),
      ],
      "test.png",
      { type: "image/png" },
    ),
  );
  const upload = await fetch(base + "/api/media", {
    method: "POST",
    headers: { origin, cookie: winner.cookie },
    body: form,
  });
  assert.equal(upload.status, 200, await upload.clone().text());
  const file = (await upload.json()) as { id: string };
  const blob = await one<{ n: number }>(
    "SELECT OCTET_LENGTH(bytes) n FROM media_objects WHERE id=?",
    [file.id],
  );
  ok("Attachment bytes stored in MySQL", blob && blob.n > 0);
  await call(a, "media?id=" + file.id, undefined, 404);
  ok("Private draft attachment not exposed to publisher", true);
  await call(
    winner,
    "community/" + task.task.id,
    { action: "submit", note: "短", confirmed: true },
    400,
  );
  ok("Completion validation enforced", true);
  await call(winner, "community/" + task.task.id, {
    action: "submit",
    note: "我完成了测试任务，并记录了三个真实观察位置。",
    confirmed: true,
  });
  const submitted = await call<TaskDetail>(a, "community/" + task.task.id);
  ok(
    "Publisher sees submitted record",
    submitted.participations[0].status === "submitted" &&
      submitted.attachments.length === 1,
  );
  const stranger = [b, c, d].find((x) => x !== winner)!;
  const hidden = await call<TaskDetail>(stranger, "community/" + task.task.id);
  ok(
    "Other participants cannot read private submissions",
    hidden.participations.length === 0 && hidden.attachments.length === 0,
  );
  await call(
    a,
    "community/" + task.task.id,
    { action: "cancel", reason: "测试取消一个尚有待验收记录的任务" },
    409,
  );
  ok("Cancellation blocked while submissions await review", true);
  await call(a, "community/" + task.task.id, {
    action: "review",
    participation: mine.id,
    decision: "rejected",
    feedback: "请补充第三个观察位置的描述",
  });
  await call(winner, "community/" + task.task.id, {
    action: "submit",
    note: "补充后的记录：在第三个位置发现了不同的植物叶片颜色。",
    confirmed: true,
  });
  ok("Reject and resubmit lifecycle", true);
  const approvals = await Promise.all(
    [1, 2].map(() =>
      call(a, "community/" + task.task.id, {
        action: "review",
        participation: mine.id,
        decision: "approved",
        feedback: "验收通过",
      }),
    ),
  );
  const earned = await one<{ n: number; total: number }>(
    "SELECT COUNT(*) n,SUM(amount) total FROM xp_ledger WHERE participation=?",
    [mine.id],
  );
  ok(
    "Concurrent duplicate approvals issue reward exactly once",
    approvals.length === 2 && earned?.n === 1 && Number(earned.total) === 20,
  );
  const personal = await call<CommunityState>(winner, "community");
  ok("Verified reward appears in growth profile", personal.xp === 20);
  await call(a, "community/" + task.task.id, {
    action: "cancel",
    reason: "测试任务流程结束，停止后续活动",
  });
  ok(
    "Cancellation preserves completed achievements",
    (await call<CommunityState>(winner, "community")).xp === 20,
  );
  const multi = await call<TaskDetail>(a, "community", template);
  await call(b, "community/" + multi.task.id, { action: "join" });
  await call(c, "community/" + multi.task.id, { action: "join" });
  ok(
    "Multiple users participate independently",
    (await call<TaskDetail>(a, "community/" + multi.task.id)).task
      .joined_count === 2,
  );
  await call(b, "community/" + multi.task.id, {
    action: "submit",
    note: "这是截止之前已经提交的完整测试记录。",
    confirmed: true,
  });
  await execute("UPDATE community_tasks SET deadline=? WHERE id=?", [
    Date.now() - 1000,
    multi.task.id,
  ]);
  await call(d, "community/" + multi.task.id, { action: "join" }, 409);
  await call(
    c,
    "community/" + multi.task.id,
    {
      action: "submit",
      note: "这是截止以后尝试提交的完整测试记录。",
      confirmed: true,
    },
    409,
  );
  ok("Server deadline blocks both late join and late submission", true);
  const late = await call<TaskDetail>(a, "community/" + multi.task.id);
  ok(
    "Deadline expires unsubmitted participation",
    late.participations.some((p) => p.status === "expired"),
  );
  const review = late.participations.find((p) => p.status === "submitted")!;
  await call(a, "community/" + multi.task.id, {
    action: "review",
    participation: review.id,
    decision: "approved",
    feedback: "",
  });
  ok("On-time submissions remain reviewable after deadline", true);
  ok(
    "Settled task archives after the deadline",
    (await call<TaskDetail>(a, "community/" + multi.task.id)).task.status ===
      "finished",
  );
  const closed = await call<TaskDetail>(a, "community", template);
  await call(b, "community/" + closed.task.id, { action: "join" });
  await call(a, "community/" + closed.task.id, { action: "close" });
  await call(c, "community/" + closed.task.id, { action: "join" }, 409);
  await call(b, "community/" + closed.task.id, {
    action: "submit",
    note: "停止新招募以后，已报名者仍然可以按时提交。",
    confirmed: true,
  });
  ok("Stopping recruitment does not invalidate existing participants", true);
  const csrf = await fetch(base + "/api/community", {
    method: "POST",
    headers: {
      origin: "https://evil.example",
      cookie: a.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(template),
  });
  ok("Cross-origin mutation rejected", csrf.status === 403);
  type Game = { runs: { id: string; status: string }[] };
  const game = await call<Game>(d, "game", { action: "accept", task: "cafe" });
  const run = game.runs.find((r) => r.status === "active")!;
  ok("Retained solo exploration accepts on MySQL", !!run);
  await call(d, "game", {
    action: "complete",
    run: run.id,
    note: "这是个人探索测试记录，已经完成了陌生小店观察。",
    place: "测试小店",
    confirmed: true,
  });
  ok("Retained solo exploration completes on MySQL", true);
  await call(d, "game", { action: "event_join" });
  await call(d, "game", { action: "favorite", task: "walk", saved: true });
  ok("Events and favorites retained on MySQL", true);
  await call(b, "game", { action: "settings", discoverable: true });
  await call(c, "game", { action: "settings", discoverable: true });
  const npc = await call<Game>(b, "game", {
    action: "accept",
    task: "book",
    place: "测试书店，今天下午公开交流",
  });
  const offer = npc.runs.find((r) => r.status === "active")!;
  await call(c, "game", { action: "join", offer: offer.id });
  ok("Retained two-player matching works on MySQL", true);
  const deadlines = await one<{ n: number }>(
    "SELECT COUNT(DISTINCT deadline) n FROM runs WHERE match_id=?",
    [offer.id],
  );
  ok("Matched players share the same deadline", deadlines?.n === 1);
  await call(b, "game", { action: "cancel", run: offer.id });
  ok(
    "Cancelling NPC invitation ends both unfinished runs",
    !(await call<Game>(c, "game")).runs.some((r) => r.status === "active"),
  );
  const timed = await call<Game>(d, "game", { action: "accept", task: "walk" });
  const timedRun = timed.runs.find((r) => r.status === "active")!;
  await execute("UPDATE runs SET deadline=? WHERE id=?", [
    Date.now() - 1,
    timedRun.id,
  ]);
  await call(
    d,
    "game",
    {
      action: "complete",
      run: timedRun.id,
      note: "测试超过个人任务截止后不能完成该任务。",
      place: "测试公共公园",
      confirmed: true,
    },
    409,
  );
  ok("Solo exploration deadline is enforced", true);
  const stale = await call<Game>(d, "game");
  ok(
    "Expired solo task releases active slot",
    !stale.runs.some((r) => r.status === "active"),
  );
  const recovered = await call<{ recoveryCode: string }>(null, "auth/recover", {
    username: d.username,
    password: "NewPassword_" + suffix,
    recoveryCode: d.recoveryCode,
  });
  await call(d, "community", undefined, 401);
  ok("Password recovery revokes prior sessions", true);
  await call(
    null,
    "auth/recover",
    {
      username: d.username,
      password: "AnotherPassword_" + suffix,
      recoveryCode: d.recoveryCode,
    },
    400,
  );
  ok(
    "Recovery code single-use and rotated",
    recovered.recoveryCode !== d.recoveryCode,
  );
  await call(a, "auth/logout", {});
  await call(a, "community", undefined, 401);
  ok("Logout invalidates server session", true);
  const unconfigured = await call<{ enabled: boolean }>(null, "map-config");
  ok("Unconfigured AMap reported explicitly", unconfigured.enabled === false);
  await writeFile(
    "tests/latest-mysql-results.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        database: "MySQL 8.4.5",
        passed: results.length,
        results,
      },
      null,
      2,
    ),
  );
  console.log(`\n${results.length} checks passed.`);
} finally {
  await pool.end();
}
