import assert from "node:assert/strict";
import { writeFile, readFile } from "node:fs/promises";
const base = process.env.TEST_URL || "http://127.0.0.1:8787";
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base))
  throw new Error("Integration fixtures are restricted to a local Worker");
const prefix = "qa_" + Date.now(),
  users = [prefix + "_a", prefix + "_b", prefix + "_c"];
let passed = 0;
const results = [];
function check(value, label) {
  assert.ok(value, label);
  passed++;
  results.push(label);
  console.log("PASS", label);
}
async function call(user, body, expected = 200) {
  const res = await fetch(base + "/api/game", {
    method: body ? "POST" : "GET",
    headers: {
      ...(user
        ? {
            "oai-authenticated-user-id": user,
            "oai-authenticated-user-email": user + "@example.test",
          }
        : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await res.json();
  assert.equal(res.status, expected, JSON.stringify(d));
  return d;
}
const [a, b, c] = users;
const profile = (name, city = "上海") => ({
  action: "profile",
  name,
  role: "职场人",
  city,
  answers: [1, 2, 1, 2, 1, 1],
});
const active = (s) => s.runs.find((r) => r.status === "active");
const complete = (run, note = "自动化测试记录：体验内容不少于十个字。") => ({
  action: "complete",
  run,
  note,
  place: "测试公共地点",
  confirmed: true,
});
await call(null, undefined, 401);
check(true, "Unauthenticated private state rejected");
await call(a, { ...profile("bad"), answers: [9] }, 400);
check(true, "Invalid profile rejected");
for (const u of users) await call(u, profile(u));
check((await call(a)).profile.name === a, "Profile survives separate reads");
await call(a, { action: "event_claim" }, 409);
await call(a, { action: "event_join" });
await call(a, { action: "event_claim" }, 409);
check(true, "Event reward requires enrollment and real completion");
let s = await call(a, { action: "accept", task: "cafe" });
const first = active(s).id;
await call(a, { action: "accept", task: "park" }, 409);
check(true, "Only one active task per player");
await call(
  b,
  { action: "draft", run: first, note: "attempt", place: "test" },
  404,
);
check(true, "Cross-user task writes rejected");
await call(a, {
  action: "draft",
  run: first,
  note: "保存这段测试草稿，刷新后应该仍然存在。",
  place: "测试小店",
  location: { lng: 121.47, lat: 31.23, accuracy: 10 },
});
check(
  (await call(a)).runs.find((r) => r.id === first).note.includes("测试草稿"),
  "Draft and location persist",
);
await call(a, { ...complete(first), note: "短" }, 400);
await call(a, { ...complete(first), confirmed: false }, 400);
check(true, "Completion requires meaningful note and explicit confirmation");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7L8AAAAASUVORK5CYII=",
  "base64",
);
async function fileUpload(file, user = a, run = first) {
  const f = new FormData();
  f.set("run", run);
  f.set("file", file);
  return fetch(base + "/api/media", {
    method: "POST",
    headers: {
      "oai-authenticated-user-id": user,
      "oai-authenticated-user-email": user + "@example.test",
    },
    body: f,
  });
}
const photo = await fileUpload(
  new File([png], "test.png", { type: "image/png" }),
);
assert.equal(photo.status, 200);
const media = await photo.json();
check(!!media.id, "Photo saved to object storage");
const voice = await fileUpload(
  new File(
    [await readFile(new URL("./silence.webm", import.meta.url))],
    "voice.webm",
    { type: "audio/webm" },
  ),
);
check(voice.status === 200, "Valid recorded audio stored");
check(
  (
    await fileUpload(
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", {
        type: "image/png",
      }),
    )
  ).status === 413,
  "Oversized attachments rejected",
);
const ownPhoto = await fetch(base + "/api/media?id=" + media.id, {
  headers: {
    "oai-authenticated-user-id": a,
    "oai-authenticated-user-email": a + "@example.test",
  },
});
check(
  ownPhoto.status === 200 &&
    Buffer.from(await ownPhoto.arrayBuffer()).equals(png),
  "Photo bytes round trip",
);
const otherPhoto = await fetch(base + "/api/media?id=" + media.id, {
  headers: {
    "oai-authenticated-user-id": b,
    "oai-authenticated-user-email": b + "@example.test",
  },
});
check(otherPhoto.status === 404, "Other users cannot read attachments");
check(
  (await fileUpload(new File(["not image"], "fake.png", { type: "image/png" })))
    .status === 400,
  "Spoofed attachment rejected",
);
check(
  (await fileUpload(new File([png], "test.svg", { type: "image/svg+xml" })))
    .status === 400,
  "Active image formats such as SVG rejected",
);
s = await call(a, complete(first));
s = await call(a, complete(first));
check(
  s.runs.filter((r) => r.status === "completed").length === 1,
  "Repeated completion does not duplicate reward",
);
await call(a, { action: "accept", task: "cafe" }, 409);
check(true, "Daily task completion cannot be farmed");
await call(a, { action: "favorite", task: "park", saved: true });
await call(a, { action: "favorite", task: "park", saved: true });
check(
  (await call(a)).favorites.length === 1,
  "Favorites idempotent and persisted",
);
await call(a, { action: "favorite", task: "park", saved: false });
check((await call(a)).favorites.length === 0, "Favorite removal works");
for (const task of ["park", "photo"]) {
  s = await call(a, { action: "accept", task });
  await call(a, complete(active(s).id));
}
s = await call(a, { action: "event_claim" });
const eventTime = s.event.completed;
s = await call(a, { action: "event_claim" });
check(
  !!eventTime && s.event.completed === eventTime,
  "Three task event completes and reward is idempotent",
);
s = await call(a, { action: "accept", task: "walk" });
const canceled = active(s).id;
await call(a, {
  action: "draft",
  run: canceled,
  note: "取消前保留的草稿",
  place: "草稿地点",
});
await call(a, { action: "cancel", run: canceled });
s = await call(a, { action: "accept", task: "walk" });
check(
  active(s).id !== canceled &&
    s.runs.find((r) => r.id === canceled).note === "取消前保留的草稿",
  "Cancel preserves history and reaccept creates a separate run",
);
await call(a, { action: "cancel", run: active(s).id });
await call(
  a,
  { action: "accept", task: "book", place: "测试图书馆，今天下午三点" },
  409,
);
check(true, "NPC discovery requires explicit opt in");
for (const u of users)
  await call(u, { action: "settings", discoverable: true });
s = await call(a, {
  action: "accept",
  task: "book",
  place: "测试图书馆，今天下午三点",
});
const host = active(s).id;
await call(a, {
  action: "draft",
  run: host,
  note: "不应公开的私人笔记",
  place: "不应公开的私人地点",
});
const offers = (await call(b)).offers;
check(
  offers.some((o) => o.id === host && o.place === "测试图书馆，今天下午三点"),
  "Public invitation separate from private draft location",
);
check(
  !JSON.stringify(offers).includes("不应公开"),
  "Private notes excluded from discovery",
);
await call(a, complete(host), 409);
check(true, "Unmatched NPC cannot complete");
await call(c, profile(c, "北京"));
await call(c, { action: "join", offer: host }, 409);
check(
  !(await call(c)).offers.some((o) => o.id === host),
  "Cross-city invitations excluded",
);
await call(c, profile(c));
const joined = await Promise.all([
  call(b, { action: "join", offer: host })
    .then((d) => ({ ok: true, user: b, data: d }))
    .catch(() => ({ ok: false, user: b })),
  call(c, { action: "join", offer: host })
    .then((d) => ({ ok: true, user: c, data: d }))
    .catch(() => ({ ok: false, user: c })),
]);
check(
  joined.filter((r) => r.ok).length === 1,
  "Concurrent join admits exactly one guest",
);
const winner = joined.find((r) => r.ok);
const guestRun = active(winner.data).id;
s = await call(a, complete(host));
check(s.encounters.length === 0, "Profile remains locked until both complete");
await call(winner.user, complete(guestRun));
s = await call(a);
check(
  s.encounters.some((p) => p.name === winner.user),
  "Both completions unlock public encounter profile",
);
check(
  !JSON.stringify(s.encounters).includes("note"),
  "Encounter profiles exclude private records",
);
s = await call(a, {
  action: "accept",
  task: "hello",
  place: "测试公共广场，明天下午三点",
});
const host2 = active(s).id;
s = await call(b, { action: "join", offer: host2 });
const guest2 = active(s).id;
await call(a, { action: "cancel", run: host2 });
check(
  (await call(b)).runs.find((r) => r.id === guest2).status === "cancelled",
  "Cancel ends both unfinished sides of an NPC match",
);
const csrf = await fetch(base + "/api/game", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: "https://other.example",
    "oai-authenticated-user-id": a,
    "oai-authenticated-user-email": a + "@example.test",
  },
  body: JSON.stringify({ action: "favorite", task: "park", saved: true }),
});
check(csrf.status === 403, "Cross-origin mutations rejected");
check(
  (
    await fetch(base + "/_AMapService/v3/place/text", {
      headers: {
        "oai-authenticated-user-id": a,
        "oai-authenticated-user-email": a + "@example.test",
      },
    })
  ).status === 503,
  "Unconfigured AMap proxy responds with recoverable state",
);
const config = await (await fetch(base + "/api/map-config")).json();
check(
  config.enabled === false && !("securityCode" in config),
  "AMap config does not expose security secret",
);
await writeFile(
  "tests/latest-api-results.json",
  JSON.stringify(
    { timestamp: new Date().toISOString(), passed, fixtures: users, results },
    null,
    2,
  ),
);
console.log(`\n${passed} integration checks passed.`);
