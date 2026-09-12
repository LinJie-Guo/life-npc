/* Native img is used for authenticated media and pre-sized local art; no remote image optimizer. */
/* eslint-disable @next/next/no-img-element */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Compass,
  Map as MapIcon,
  Footprints,
  Users,
  User,
  ArrowUpRight,
  Sparkles,
  LocateFixed,
  ChevronRight,
  ArrowLeft,
  Coffee,
  Trees,
  Camera,
  BookOpen,
  Clock,
  Check,
  CheckCircle2,
  Bookmark,
  Settings,
  RefreshCw,
  MapPin,
  Mic,
  Square,
  LoaderCircle,
  ExternalLink,
  Trophy,
  Shield,
  X,
  Download,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Toaster, toast } from "sonner";
import {
  quests,
  questions,
  roles,
  cities,
  attributes,
  baseStats,
  dayKey,
  amapLink,
  type Quest,
} from "@/lib/catalog";
import type { GameState, Run, Media } from "@/lib/types";
import WorldMap from "../world-map";
import { Sidebar, SidebarProvider } from "@/components/ui/sidebar";
import { NativeSelect } from "@/components/ui/native-select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
const icons = { Coffee, Footprints, Trees, Camera, BookOpen, Users };
const nav = [
  { id: "home", label: "今日探索", icon: Compass },
  { id: "map", label: "世界地图", icon: MapIcon },
  { id: "tasks", label: "我的任务", icon: Footprints },
  { id: "npc", label: "真人 NPC", icon: Users },
  { id: "profile", label: "成长档案", icon: User },
];
function Radar({ values }: { values: number[] }) {
  const point = (i: number, r: number) => [
    120 + Math.sin((i * Math.PI) / 3) * r,
    110 - Math.cos((i * Math.PI) / 3) * r,
  ];
  return (
    <svg
      viewBox="0 0 240 235"
      role="img"
      aria-label={attributes.map((a, i) => `${a} ${values[i]}/10`).join("，")}
      className="radar"
    >
      {[0.25, 0.5, 0.75, 1].map((v) => (
        <polygon
          key={v}
          points={values.map((_, i) => point(i, 75 * v).join(",")).join(" ")}
          fill="none"
          stroke="#2a414c"
        />
      ))}
      {attributes.map((a, i) => {
        const [x, y] = point(i, 98);
        return (
          <g key={a}>
            <line
              x1="120"
              y1="110"
              x2={point(i, 75)[0]}
              y2={point(i, 75)[1]}
              stroke="#2a414c"
            />
            <text x={x} y={y} textAnchor="middle" fill="#98b3bf" fontSize="12">
              {a}
            </text>
            <text
              x={x}
              y={y + 16}
              textAnchor="middle"
              fill="#def7ee"
              fontSize="12"
            >
              {values[i]}
            </text>
          </g>
        );
      })}
      <polygon
        points={values
          .map((v, i) => point(i, (Math.min(10, v) / 10) * 75).join(","))
          .join(" ")}
        fill="#6aeac62b"
        stroke="#7bf0cf"
        strokeWidth="1.5"
      />
      {values.map((v, i) => (
        <circle
          key={i}
          cx={point(i, (Math.min(10, v) / 10) * 75)[0]}
          cy={point(i, (Math.min(10, v) / 10) * 75)[1]}
          r="3"
          fill="#b1ffe3"
        />
      ))}
    </svg>
  );
}
function Timer({ start }: { start: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const n = Math.max(0, Math.floor((now - start) / 1000));
  return (
    <span>
      {[Math.floor(n / 3600), Math.floor(n / 60) % 60, n % 60]
        .map((x) => String(x).padStart(2, "0"))
        .join(":")}
    </span>
  );
}
async function request(body?: unknown) {
  const res = await fetch("/api/game", {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = (await res.json()) as GameState & { error?: string };
  if (!res.ok) throw new Error(data.error || "暂时无法连接，请重试");
  return data as GameState;
}
export default function Home() {
  const [data, setData] = useState<GameState | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [view, setView] = useState("home"),
    [filter, setFilter] = useState("all"),
    [taskFilter, setTaskFilter] = useState("active"),
    [selected, setSelected] = useState<Quest | null>(null),
    [result, setResult] = useState<Quest | null>(null),
    [onboarding, setOnboarding] = useState(false),
    [step, setStep] = useState(0),
    [name, setName] = useState(""),
    [role, setRole] = useState("职场人"),
    [city, setCity] = useState("上海"),
    [answers, setAnswers] = useState([1, 1, 1, 1, 1, 1]),
    [settings, setSettings] = useState(false),
    [confirmCancel, setConfirmCancel] = useState(false),
    [shuffle, setShuffle] = useState(0),
    [archive, setArchive] = useState<Run | null>(null);
  const [note, setNote] = useState(""),
    [place, setPlace] = useState(""),
    [coords, setCoords] = useState<{
      lat: number;
      lng: number;
      accuracy: number;
    } | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [recording, setRecording] = useState(false),
    [uploading, setUploading] = useState(false),
    [locating, setLocating] = useState(false),
    [invitation, setInvitation] = useState(""),
    [theme, setTheme] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null),
    audioStream = useRef<MediaStream | null>(null),
    recordTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    fileRef = useRef<HTMLInputElement>(null),
    loadedRun = useRef<string | null>(null),
    actionRef = useRef<(body: unknown) => Promise<GameState | undefined>>(
      async () => undefined,
    ),
    dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const reload = useCallback(async () => {
    try {
      const d = await request();
      setData(d);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    void request()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        const saved = localStorage.getItem("life-npc-light") === "true";
        setTheme(saved);
        document.documentElement.classList.toggle("light", saved);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  // Hydrate the initial URL state after SSR; subsequent changes use the browser subscription.
  useEffect(() => {
    const hash = location.hash.slice(1);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if ([...nav.map((n) => n.id), "event"].includes(hash)) setView(hash);
    const update = () => {
      const next = location.hash.slice(1);
      if ([...nav.map((n) => n.id), "event"].includes(next)) setView(next);
    };
    addEventListener("hashchange", update);
    return () => removeEventListener("hashchange", update);
  }, []);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);
  const navigate = (to: string) => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    setView(to);
    window.history.pushState(null, "", "#" + to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const mutate = useCallback(async (body: unknown) => {
    setBusy(true);
    try {
      const d = await request(body);
      setData(d);
      return d;
    } catch (e) {
      toast.error((e as Error).message);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    actionRef.current = mutate;
  }, [mutate]);
  const active = data?.runs.find((r) => r.status === "active"),
    activeQuest = quests.find((q) => q.id === active?.task),
    done = data?.runs.filter((r) => r.status === "completed") || [],
    xp =
      done.reduce(
        (sum, r) => sum + (quests.find((q) => q.id === r.task)?.xp || 0),
        0,
      ) +
      (data?.event?.completed ? 50 : 0) +
      (data?.communityXp || 0),
    level = Math.floor(xp / 100) + 1,
    profile = data?.profile,
    stats = profile
      ? baseStats(profile.answers).map((v, i) =>
          Math.min(
            10,
            v +
              Math.floor(
                done.filter(
                  (r) => quests.find((q) => q.id === r.task)?.attribute === i,
                ).length / 3,
              ),
          ),
        )
      : [4, 4, 4, 4, 4, 4];
  useEffect(() => {
    if (active?.id !== loadedRun.current) {
      loadedRun.current = active?.id || null;
      setNote(active?.note || "");
      setPlace(active?.place || "");
      setCoords(active?.location ? JSON.parse(active.location) : null);
      setConfirmed(false);
    }
  }, [active]);
  useEffect(() => {
    if (!active || activeQuest?.kind !== "npc") return;
    const id = setInterval(() => void reload(), 15000);
    return () => clearInterval(id);
  }, [active, activeQuest?.kind, reload]);
  useEffect(
    () => () => {
      if (recordTimer.current) clearTimeout(recordTimer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      audioStream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (tool: unknown, options: unknown) => Promise<void>;
        };
      }
    ).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    const tools = [
      {
        name: "read_life_npc_progress",
        title: "查看探索进度",
        description: "读取当前玩家任务和成长进度，不包含私密体验记录。",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: async () => ({
          tasks: dataRef.current?.runs.map((r) => ({
            id: r.id,
            task: r.task,
            status: r.status,
          })),
          onboarded: !!dataRef.current?.profile,
        }),
      },
      {
        name: "accept_life_npc_task",
        title: "接受现实探索任务",
        description:
          "接受一个探索任务。开始记录实际旅程，不能代替用户完成现实活动。",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              enum: quests.filter((q) => q.kind === "explore").map((q) => q.id),
            },
          },
          required: ["taskId"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: async (input: unknown) => {
          const task = (input as { taskId?: string })?.taskId;
          if (!quests.some((q) => q.id === task && q.kind === "explore"))
            throw new Error("无效任务");
          const d = await actionRef.current({ action: "accept", task });
          if (!d) throw new Error("未接受任务，请检查当前进度");
          setView("tasks");
          window.history.pushState(null, "", "#tasks");
          return { active: d.runs.find((r) => r.status === "active")?.id };
        },
      },
    ];
    tools.forEach((t) =>
      Promise.resolve(
        context.registerTool(t, { signal: lifecycle.signal }),
      ).catch(() => {}),
    );
    return () => lifecycle.abort();
  }, []);
  const begin = () => {
    setName(profile?.name || "");
    setRole(profile?.role || "职场人");
    setCity(profile?.city || "上海");
    setAnswers(profile?.answers || [1, 1, 1, 1, 1, 1]);
    setStep(0);
    setOnboarding(true);
  };
  async function accept(q: Quest) {
    if (!profile) {
      setSelected(null);
      begin();
      return;
    }
    const d = await mutate({
      action: "accept",
      task: q.id,
      place: q.kind === "npc" ? invitation : undefined,
    });
    if (d) {
      setSelected(null);
      navigate("tasks");
      toast.success(
        q.kind === "npc"
          ? "邀请已发布，等待另一位探索者"
          : "任务已接受，出发吧",
      );
    }
  }
  async function upload(file: File) {
    if (!active) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("run", active.id);
      const res = await fetch("/api/media", { method: "POST", body });
      const obj = (await res.json()) as Media & { error?: string };
      if (!res.ok) throw new Error(obj.error);
      setData((d) => (d ? { ...d, media: [...d.media, obj] } : d));
      toast.success("记录已保存");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  async function record() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error("当前浏览器不支持录音，请使用文字或照片记录");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStream.current = stream;
      const mime = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      recorder.current = r;
      const chunks: BlobPart[] = [];
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        if (recordTimer.current) clearTimeout(recordTimer.current);
        const blob = new Blob(chunks, { type: r.mimeType });
        void upload(new File([blob], "voice", { type: r.mimeType }));
      };
      r.start();
      setRecording(true);
      recordTimer.current = setTimeout(
        () => r.state === "recording" && r.stop(),
        60000,
      );
    } catch (e) {
      audioStream.current?.getTracks().forEach((t) => t.stop());
      toast.error(
        (e as Error).name === "NotAllowedError"
          ? "未获得麦克风权限，你仍可以用文字记录"
          : (e as Error).message,
      );
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      toast.error("当前浏览器不支持定位");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
        });
        setLocating(false);
        toast.success("已获取位置，保存或完成时写入私人记录");
      },
      () => {
        setLocating(false);
        toast.error("未能获取定位，请手动填写地点名称");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }
  const date = (n: number) =>
    new Date(n).toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
  const available = quests.filter(
    (q) =>
      q.kind === "explore" &&
      !done.some((r) => r.task === q.id && r.day === dayKey()),
  );
  const recommended = [...available].sort(
    (a, b) => stats[a.attribute] - stats[b.attribute],
  )[shuffle % Math.max(1, available.length)];
  const featured = recommended || quests[0];
  const repeat = profile
    ? Math.round(
        100 -
          ((profile.answers[0] + profile.answers[3] + profile.answers[5]) / 9) *
            65,
      )
    : null;
  const eventDone = data?.event
    ? ["cafe", "park", "photo"].filter((id) =>
        done.some(
          (r) =>
            r.task === id &&
            r.completed! >= data.event!.started &&
            r.completed! <= data.event!.started + 86400000,
        ),
      )
    : [];
  const card = (q: Quest) => {
    const Icon = icons[q.icon as keyof typeof icons],
      isDone = done.some((r) => r.task === q.id && r.day === dayKey());
    return (
      <button
        key={q.id}
        className="quest-card"
        onClick={() => {
          setInvitation("");
          setSelected(q);
        }}
      >
        <span className={`quest-icon ${q.id}`}>
          <Icon size={23} />
        </span>
        <div>
          <span className="eyebrow">
            {q.category} · {q.minutes} 分钟
          </span>
          <h3>{q.title}</h3>
          <span className="small muted">
            {isDone
              ? "今日已完成"
              : `+${q.xp} 经验值 · ${attributes[q.attribute]}成长`}
          </span>
        </div>
        <ChevronRight size={18} />
      </button>
    );
  };
  const toggleFavorite = async (q: Quest) => {
    if (!profile) {
      setSelected(null);
      begin();
      return;
    }
    await mutate({
      action: "favorite",
      task: q.id,
      saved: !data?.favorites.includes(q.id),
    });
  };
  return (
    <>
      <Toaster
        theme={theme ? "light" : "dark"}
        position="top-center"
        richColors
      />
      <SidebarProvider className="shell">
        <Sidebar collapsible="none" className="rail">
          <a href="#home" className="brand">
            <Compass />
            人生 NPC<span>REAL LIFE · NEW GAME</span>
          </a>
          <nav aria-label="主导航">
            {nav.map((n) => (
              <button
                key={n.id}
                className={view === n.id ? "active" : ""}
                aria-current={view === n.id ? "page" : undefined}
                onClick={() => navigate(n.id)}
              >
                <n.icon />
                {n.label}
                {n.id === "tasks" && active && <i />}
              </button>
            ))}
          </nav>
          <div className="rail-bottom">
            <div className="level-mini">
              <span className="avatar">{profile?.name?.[0] || "N"}</span>
              <div>
                {profile?.name || "新来的探索者"}
                <small>
                  Lv.{level} · {xp} XP
                </small>
              </div>
            </div>
            <p>走出日常，遇见可能。</p>
            <small>每一个小小的开始，都算数。</small>
          </div>
        </Sidebar>
        <main className="workspace">
          <header>
            <button
              className="location-button"
              onClick={() => (profile ? setSettings(true) : begin())}
            >
              <LocateFixed size={16} />
              {profile?.city || "上海"} ·{" "}
              {profile ? "你的探索城市" : "探索起点"}
            </button>
            <span className="eyebrow">YOUR LIFE, YOUR ADVENTURE</span>
            <button
              aria-label="设置"
              className="icon-button"
              onClick={() => setSettings(true)}
            >
              <Settings size={19} />
            </button>
          </header>
          {error && (
            <div role="alert" className="error-banner">
              {error}
              <button onClick={() => void reload()}>重试</button>
              {error.includes("登录") && (
                <a href="/" target="_top">
                  登录
                </a>
              )}
            </div>
          )}
          {!data && !error ? (
            <div className="empty">
              <LoaderCircle className="spin" />
              <h2>正在载入你的旅程…</h2>
            </div>
          ) : (
            <>
              {view === "home" && (
                <>
                  <div className="welcome">
                    <div>
                      <p className="eyebrow">
                        {profile
                          ? `${profile.name}，今天也有新的可能`
                          : "新的一天，新的可能"}
                      </p>
                      <h1>
                        今天，给生活一点意外<span>。</span>
                      </h1>
                      <p className="muted">
                        从一件没做过的小事开始，拓展你的世界。
                      </p>
                    </div>
                    <span className="day">
                      DAY{" "}
                      <strong>
                        {String(
                          profile
                            ? Math.floor((now - profile.created) / 86400000) + 1
                            : 1,
                        ).padStart(2, "0")}
                      </strong>
                    </span>
                  </div>
                  {active && (
                    <button
                      className="active-banner"
                      onClick={() => navigate("tasks")}
                    >
                      <span>
                        <span className="live-dot" />
                        旅程进行中 · {activeQuest?.title}
                      </span>
                      <span>
                        继续任务 <ChevronRight size={16} />
                      </span>
                    </button>
                  )}
                  <div className="dashboard">
                    <section>
                      <div className="section-heading">
                        <h2>今日推荐</h2>
                        <button
                          className="text-button"
                          onClick={() => setShuffle(shuffle + 1)}
                        >
                          <RefreshCw size={14} />
                          换个灵感
                        </button>
                      </div>
                      <article className="quest-hero">
                        <img
                          className="hero-image"
                          src="/images/cafe.png"
                          alt="夜色中一间亮着温暖灯光的街角咖啡馆"
                        />
                        <div className="hero-copy">
                          <span className="badge">
                            {featured.category} · Lv.1
                          </span>
                          <h2>
                            {featured.id === "cafe" ? (
                              <>
                                推开一家
                                <br />
                                陌生小店的门
                              </>
                            ) : (
                              featured.title
                            )}
                          </h2>
                          <p>{featured.description}</p>
                          <div className="reward">
                            ✦ +{featured.xp} 经验值　✧{" "}
                            {attributes[featured.attribute]}成长
                          </div>
                          <button
                            className="primary"
                            onClick={() =>
                              profile ? setSelected(featured) : begin()
                            }
                          >
                            {profile ? "查看探索任务" : "开始我的旅程"}{" "}
                            <ArrowUpRight size={20} />
                          </button>
                        </div>
                        <span className="photo-note">
                          城市探索灵感 · 场景插画
                        </span>
                      </article>
                      <div className="section-heading lower">
                        <h2>更多生活支线</h2>
                        <span>小挑战，也有大收获</span>
                      </div>
                      <div className="quest-list">
                        {quests
                          .filter(
                            (q) => q.id !== featured.id && q.kind === "explore",
                          )
                          .slice(0, 3)
                          .map(card)}
                      </div>
                    </section>
                    <div className="right-column">
                      <aside className="panel portrait">
                        <div className="section-heading">
                          <h2>我的生活画像</h2>
                          <Sparkles size={18} className="accent" />
                        </div>
                        <Radar values={stats} />
                        {profile ? (
                          <>
                            <div className="portrait-summary">
                              <span>生活重复率 · 自评</span>
                              <strong>{repeat}%</strong>
                            </div>
                            <p className="muted">
                              {stats[0] <= 4
                                ? "从一个小小的新尝试开始。"
                                : "继续保持好奇，你的世界正在展开。"}
                            </p>
                            <button
                              className="text-button"
                              onClick={() => navigate("profile")}
                            >
                              查看成长档案 <ChevronRight size={15} />
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="muted">
                              完成 6 个小问题，找到属于你的探索方向。
                            </p>
                            <button className="outline full" onClick={begin}>
                              开始生活扫描 <ArrowUpRight size={16} />
                            </button>
                          </>
                        )}
                      </aside>
                      <button
                        className="event-preview"
                        onClick={() => navigate("event")}
                      >
                        <span className="eyebrow">CITY QUEST / 城市事件</span>
                        <div className="event-mark">
                          <MapPin size={30} />
                          <span>
                            24<small>HOURS</small>
                          </span>
                        </div>
                        <h3>城市探索计划</h3>
                        <p>一家小店，一处绿地，一抹色彩。</p>
                        <span className="accent">
                          完成三站 · 获得 50 XP <ArrowUpRight size={15} />
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              )}
              {view === "tasks" && (
                <>
                  <div className="page-heading">
                    <p className="eyebrow">YOUR QUEST LOG</p>
                    <h1>
                      每一步，都有迹可循<span>。</span>
                    </h1>
                    <p className="muted">
                      记录现实中的体验，把小小的变化留住。
                    </p>
                  </div>
                  {active && activeQuest ? (
                    <div className="execution-layout">
                      <section className="panel execution">
                        <div className="section-heading">
                          <span className="badge">
                            {activeQuest.kind === "npc"
                              ? "真人 NPC"
                              : "现实探索"}{" "}
                            · 进行中
                          </span>
                          <button
                            className="text-button"
                            onClick={() => setConfirmCancel(true)}
                          >
                            结束本次任务
                          </button>
                        </div>
                        <h2>{activeQuest.title}</h2>
                        <p className="muted">{activeQuest.description}</p>
                        <div className="timer-ring">
                          <Timer start={active.started} />
                          <span>
                            截止{" "}
                            {new Date(active.deadline).toLocaleString("zh-CN", {
                              timeZone: "Asia/Shanghai",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span>
                            {activeQuest.kind === "npc" && !active.partner
                              ? "等待玩家加入"
                              : "好奇正在发生"}
                          </span>
                        </div>
                        {activeQuest.kind === "npc" && (
                          <div className="info-box">
                            {active.partner
                              ? "已匹配一位同城玩家。按邀请中的公开地点交流，双方完成后解锁公开档案。"
                              : "邀请已发布。没有玩家加入时，可以结束邀请再探索其他任务；不会扣除经验。"}
                            {active.invitation && (
                              <p>约定：{active.invitation}</p>
                            )}
                            <button
                              className="text-button"
                              onClick={() => void reload()}
                            >
                              <RefreshCw size={14} />
                              刷新匹配状态
                            </button>
                          </div>
                        )}
                        <ol className="steps">
                          {activeQuest.steps.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ol>
                      </section>
                      <section className="panel evidence">
                        <h2>留下这次探索的印记</h2>
                        <p className="muted">
                          记录仅自己可见。请真实填写，文字记录即可完成。
                        </p>
                        <label className="field">
                          探索地点
                          <input
                            value={place}
                            onChange={(e) => setPlace(e.target.value)}
                            maxLength={100}
                            placeholder="例如：街角的一家小店 / 中山公园"
                          />
                        </label>
                        <label className="field">
                          今天有什么新发现？
                          <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            maxLength={2000}
                            rows={5}
                            placeholder="写下一个细节、一段对话，或此刻的心情（至少 10 个字）"
                          />
                          <span className="char-count">
                            {note.trim().length} / 2000
                          </span>
                        </label>
                        <div className="evidence-tools">
                          <button
                            className="outline"
                            disabled={uploading}
                            onClick={() => fileRef.current?.click()}
                          >
                            <Camera size={18} />
                            {uploading ? "保存中" : "照片"}
                          </button>
                          <button
                            className="outline"
                            disabled={locating}
                            onClick={locate}
                          >
                            <MapPin size={18} />
                            {locating ? "定位中" : "定位"}
                          </button>
                          <button
                            className={`outline ${recording ? "recording" : ""}`}
                            disabled={uploading}
                            onClick={() => void record()}
                          >
                            {recording ? (
                              <Square size={18} />
                            ) : (
                              <Mic size={18} />
                            )}{" "}
                            {recording ? "结束录音" : "语音"}
                          </button>
                        </div>
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          capture="environment"
                          hidden
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void upload(file);
                            e.target.value = "";
                          }}
                        />
                        {recording && (
                          <p className="small accent">
                            正在录音，最长 60 秒。结束后保存到本次任务。
                          </p>
                        )}
                        {coords && (
                          <div className="location-chip">
                            <LocateFixed size={15} />
                            位置已记录 · 精度约 {Math.round(coords.accuracy)} 米
                            <button
                              aria-label="移除定位"
                              onClick={() => setCoords(null)}
                            >
                              <X size={15} />
                            </button>
                          </div>
                        )}
                        <div className="attachments">
                          {data?.media
                            .filter((m) => m.run === active.id)
                            .map((m) =>
                              m.type.startsWith("image") ? (
                                <a
                                  key={m.id}
                                  href={"/api/media?id=" + m.id}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <img
                                    alt="本次探索的照片"
                                    src={"/api/media?id=" + m.id}
                                  />
                                </a>
                              ) : (
                                <audio
                                  key={m.id}
                                  controls
                                  src={"/api/media?id=" + m.id}
                                />
                              ),
                            )}
                        </div>
                        <label className="check-line">
                          <Checkbox
                            checked={confirmed}
                            onCheckedChange={(v) => setConfirmed(v === true)}
                          />
                          我已在现实中完成任务，并记录了真实体验。
                        </label>
                        <div className="button-row">
                          <button
                            className="outline"
                            disabled={busy || uploading || recording}
                            onClick={async () => {
                              if (
                                await mutate({
                                  action: "draft",
                                  run: active.id,
                                  note,
                                  place,
                                  location: coords,
                                })
                              )
                                toast.success("探索记录已保存");
                            }}
                          >
                            保存草稿
                          </button>
                          <button
                            className="primary grow"
                            disabled={
                              busy ||
                              uploading ||
                              recording ||
                              !confirmed ||
                              note.trim().length < 10 ||
                              place.trim().length < 2 ||
                              (activeQuest.kind === "npc" && !active.partner)
                            }
                            onClick={async () => {
                              const q = activeQuest;
                              if (
                                await mutate({
                                  action: "complete",
                                  run: active.id,
                                  note,
                                  place,
                                  location: coords,
                                  confirmed,
                                })
                              ) {
                                setResult(q);
                              }
                            }}
                          >
                            {busy ? (
                              <LoaderCircle className="spin" size={18} />
                            ) : (
                              <Check size={18} />
                            )}
                            完成任务
                          </button>
                        </div>
                      </section>
                    </div>
                  ) : (
                    <div className="empty panel">
                      <Footprints size={40} />
                      <h2>下一段旅程，等你开启</h2>
                      <p className="muted">
                        挑一个小任务，让今天多一点不一样。
                      </p>
                      <button
                        className="primary"
                        onClick={() => navigate("home")}
                      >
                        去发现任务 <ArrowUpRight size={18} />
                      </button>
                    </div>
                  )}
                  <div className="section-heading lower">
                    <h2>探索记录</h2>
                    <Tabs value={taskFilter} onValueChange={setTaskFilter}>
                      <TabsList>
                        <TabsTrigger value="active">已完成</TabsTrigger>
                        <TabsTrigger value="cancelled">已结束</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  {data?.runs.filter(
                    (r) =>
                      r.status ===
                      (taskFilter === "active" ? "completed" : "cancelled"),
                  ).length ? (
                    <div className="history-list">
                      {data.runs
                        .filter(
                          (r) =>
                            r.status ===
                            (taskFilter === "active"
                              ? "completed"
                              : "cancelled"),
                        )
                        .map((r) => (
                          <button
                            key={r.id}
                            className="history-row"
                            onClick={() => setArchive(r)}
                          >
                            <span className="quest-icon">
                              <CheckCircle2 size={21} />
                            </span>
                            <div>
                              <h3>
                                {quests.find((q) => q.id === r.task)?.title}
                              </h3>
                              <p>
                                {r.place || "未记录地点"} ·{" "}
                                {date(r.completed || r.started)}
                              </p>
                            </div>
                            <span className="accent">
                              {r.status === "completed"
                                ? `+${quests.find((q) => q.id === r.task)?.xp} XP`
                                : "已结束"}
                            </span>
                            <ChevronRight size={16} />
                          </button>
                        ))}
                    </div>
                  ) : (
                    <p className="empty-line">这里将记录你走过的每一步。</p>
                  )}
                </>
              )}
              {view === "map" && (
                <>
                  <div className="page-heading">
                    <p className="eyebrow">THE WORLD IS YOUR PLAYGROUND</p>
                    <h1>
                      让你的世界，大一点<span>。</span>
                    </h1>
                    <p className="muted">
                      从身边出发，发现新的地点、任务和相遇。
                    </p>
                  </div>
                  <div className="section-heading">
                    <Tabs value={filter} onValueChange={setFilter}>
                      <TabsList>
                        <TabsTrigger value="all">全部</TabsTrigger>
                        <TabsTrigger value="explore">探索任务</TabsTrigger>
                        <TabsTrigger value="npc">真人 NPC</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <button
                      className="text-button"
                      onClick={() => navigate("event")}
                    >
                      城市事件 <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <WorldMap
                    city={profile?.city || "上海"}
                    filter={filter}
                    onSelect={setSelected}
                  />
                  <div className="map-stats">
                    <div>
                      <strong>
                        {new Set(done.map((r) => r.place).filter(Boolean)).size}
                      </strong>
                      <span>探索过的地点</span>
                    </div>
                    <div>
                      <strong>{data?.encounters.length || 0}</strong>
                      <span>真实的相遇</span>
                    </div>
                    <div>
                      <strong>{done.length}</strong>
                      <span>完成的任务</span>
                    </div>
                  </div>
                  <div className="section-heading lower">
                    <h2>你的城市探索清单</h2>
                    <span>选择适合自己的目的地</span>
                  </div>
                  <div className="card-grid">
                    {quests
                      .filter((q) => filter === "all" || q.kind === filter)
                      .map(card)}
                  </div>
                </>
              )}
              {view === "npc" && (
                <>
                  <div className="page-heading">
                    <p className="eyebrow">REAL PEOPLE, SMALL CONNECTIONS</p>
                    <h1>
                      你也可以，成为别人的奇遇<span>。</span>
                    </h1>
                    <p className="muted">
                      通过一个小任务，认识另一位同城探索者。
                    </p>
                  </div>
                  <div className="npc-layout">
                    <section>
                      <div className="consent-panel">
                        <Users className="accent" />
                        <div>
                          <h2>同城发现</h2>
                          <p>
                            开启后，其他玩家可看到你的昵称、身份、城市与公开邀请。你的私人记录和精确定位不会公开。
                          </p>
                        </div>
                        <Switch
                          aria-label="开启同城发现"
                          checked={!!profile?.discoverable}
                          disabled={busy}
                          onCheckedChange={async (checked) => {
                            if (!profile) {
                              begin();
                              return;
                            }
                            await mutate({
                              action: "settings",
                              discoverable: checked,
                            });
                          }}
                        />
                      </div>
                      <div className="section-heading lower">
                        <h2>来自 {profile?.city || "上海"} 的邀请</h2>
                        <button
                          className="text-button"
                          onClick={() => void reload()}
                        >
                          <RefreshCw size={15} />
                          刷新
                        </button>
                      </div>
                      {data?.offers.length ? (
                        <div className="quest-list">
                          {data.offers.map((o) => (
                            <article className="offer-card" key={o.id}>
                              <div className="person">
                                <span className="avatar">{o.name[0]}</span>
                                <div>
                                  <h3>{o.name}</h3>
                                  <p>
                                    {o.role} · {o.city}
                                  </p>
                                </div>
                                <span className="badge purple">真人邀请</span>
                              </div>
                              <h2>
                                {quests.find((q) => q.id === o.task)?.title}
                              </h2>
                              <p className="muted">
                                {o.place || "请在公共场所进行交流"}
                              </p>
                              <button
                                className="primary"
                                disabled={busy || !!active}
                                onClick={async () => {
                                  if (
                                    await mutate({
                                      action: "join",
                                      offer: o.id,
                                    })
                                  ) {
                                    toast.success("匹配成功，开启一段新的相遇");
                                    navigate("tasks");
                                  }
                                }}
                              >
                                加入这次相遇 <ArrowUpRight size={17} />
                              </button>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="empty panel">
                          <Users size={38} />
                          <h2>
                            {profile?.discoverable
                              ? "此刻还没有可加入的邀请"
                              : "开启同城发现，遇见新的人"}
                          </h2>
                          <p className="muted">
                            {profile?.discoverable
                              ? "发出第一份邀请，让一段真实的相遇从你开始。"
                              : "你可以随时关闭，决定自己的社交节奏。"}
                          </p>
                        </div>
                      )}
                      <div className="section-heading lower">
                        <h2>发起一个真人任务</h2>
                      </div>
                      <div className="quest-list">
                        {quests.filter((q) => q.kind === "npc").map(card)}
                      </div>
                    </section>
                    <aside className="panel npc-note">
                      <div className="connection-symbol">
                        <span className="avatar">你</span>
                        <span>✦</span>
                        <span className="avatar lilac">?</span>
                      </div>
                      <h2>一段轻松、真诚的交集</h2>
                      <p className="muted">
                        一本好书、一个私藏地点，都可以成为对话的开始。
                      </p>
                      <div className="divider" />
                      <Shield size={21} className="accent" />
                      <h3>按自己的节奏相遇</h3>
                      <p className="muted">
                        约在公共场所，先征得对方同意。无需交换联系方式，也可以随时结束任务。
                      </p>
                      <p className="muted">
                        只有双方都完成后，才会出现在彼此的相遇档案中。
                      </p>
                    </aside>
                  </div>
                </>
              )}
              {view === "event" && (
                <>
                  <button
                    className="back-button"
                    onClick={() => navigate("home")}
                  >
                    <ArrowLeft size={17} />
                    返回探索
                  </button>
                  <div className="event-page panel">
                    <span className="badge purple">城市事件 · 随时开启</span>
                    <p className="eyebrow">THREE STOPS, A DIFFERENT DAY</p>
                    <h1>
                      城市探索计划<span>。</span>
                    </h1>
                    <p className="muted">
                      在加入后的 24 小时内，完成三种不同的城市体验。
                      <br />
                      不用走很远，也能重新发现生活。
                    </p>
                    <div className="event-meta">
                      <span>
                        <Users size={17} />
                        {data?.participants || 0} 位探索者近 24 小时加入
                      </span>
                      <span>
                        <Trophy size={17} /> +50 XP · 城市探索者徽章
                      </span>
                    </div>
                    {data?.event && (
                      <div className="event-progress">
                        <Progress value={(eventDone.length / 3) * 100} />
                        <p>
                          {eventDone.length} / 3 站完成{" "}
                          {data.event.completed
                            ? "· 已领取奖励"
                            : now > data.event.started + 86400000
                              ? "· 本期时间已结束"
                              : `· 截止 ${new Date(data.event.started + 86400000).toLocaleString("zh-CN")}`}
                        </p>
                      </div>
                    )}
                    <div className="event-stops">
                      {["cafe", "park", "photo"].map((id, i) => {
                        const q = quests.find((q) => q.id === id)!;
                        return (
                          <button key={id} onClick={() => setSelected(q)}>
                            <span
                              className={
                                eventDone.includes(id) ? "finished" : ""
                              }
                            >
                              {eventDone.includes(id) ? (
                                <Check size={22} />
                              ) : (
                                String(i + 1).padStart(2, "0")
                              )}
                            </span>
                            <h3>{q.short}</h3>
                            <p>{q.title}</p>
                            <ChevronRight size={18} />
                          </button>
                        );
                      })}
                    </div>
                    {!profile ? (
                      <button className="primary" onClick={begin}>
                        建立档案并加入
                      </button>
                    ) : data?.event?.completed ? (
                      <div className="accent">
                        <CheckCircle2 />
                        城市探索者 · 奖励已收入档案
                      </div>
                    ) : eventDone.length === 3 ? (
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={async () => {
                          if (await mutate({ action: "event_claim" }))
                            toast.success("城市探索完成！+50 XP 已收入档案");
                        }}
                      >
                        领取城市探索奖励
                      </button>
                    ) : !data?.event || now > data.event.started + 86400000 ? (
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={async () => {
                          if (await mutate({ action: "event_join" }))
                            toast.success("已加入，从第一站开始吧");
                        }}
                      >
                        {data?.event ? "重新开启 24 小时挑战" : "加入探索计划"}{" "}
                        <ArrowUpRight size={18} />
                      </button>
                    ) : (
                      <button
                        className="primary"
                        onClick={() =>
                          setSelected(
                            quests.find(
                              (q) =>
                                q.id ===
                                ["cafe", "park", "photo"].find(
                                  (id) => !eventDone.includes(id),
                                ),
                            )!,
                          )
                        }
                      >
                        继续下一站 <ArrowUpRight size={18} />
                      </button>
                    )}
                    <p className="small muted">
                      仅统计加入后完成的指定任务。每项任务每日奖励一次，已完成的任务可在次日再次探索。
                    </p>
                  </div>
                </>
              )}
              {view === "profile" && (
                <>
                  <div className="page-heading">
                    <p className="eyebrow">A BETTER YOU, ONE STEP AT A TIME</p>
                    <h1>
                      你走过的路，都在这里<span>。</span>
                    </h1>
                  </div>
                  {!profile ? (
                    <div className="empty panel">
                      <User size={40} />
                      <h2>你的角色，等待创建</h2>
                      <p className="muted">认识此刻的自己，写下下一章。</p>
                      <button className="primary" onClick={begin}>
                        创建成长档案
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="profile-summary panel">
                        <div className="avatar large">{profile.name[0]}</div>
                        <div className="profile-name">
                          <span className="eyebrow">PLAYER PROFILE</span>
                          <h2>{profile.name}</h2>
                          <p>
                            {profile.role} · {profile.city} ·{" "}
                            {date(profile.created)} 开始探索
                          </p>
                          <div className="level-bar">
                            <strong>Lv.{level}</strong>
                            <Progress value={xp % 100} />
                            <span>{xp % 100} / 100 XP</span>
                          </div>
                        </div>
                        <button className="outline" onClick={begin}>
                          编辑档案
                        </button>
                      </div>
                      <div className="map-stats profile-stats">
                        <div>
                          <strong>{done.length}</strong>
                          <span>完成任务</span>
                        </div>
                        <div>
                          <strong>{xp}</strong>
                          <span>累计经验</span>
                        </div>
                        <div>
                          <strong>{data?.encounters.length || 0}</strong>
                          <span>真实相遇</span>
                        </div>
                        <div>
                          <strong>{data?.favorites.length || 0}</strong>
                          <span>收藏任务</span>
                        </div>
                      </div>
                      <div className="profile-grid">
                        <section className="panel">
                          <h2>成长中的你</h2>
                          <Radar values={stats} />
                          <p className="muted small">
                            初始属性来自自评；每完成 3 次对应任务，属性增加 1
                            点（上限 10）。生活画像不代表心理测评。
                          </p>
                          <button className="text-button" onClick={begin}>
                            重新扫描 <RefreshCw size={14} />
                          </button>
                        </section>
                        <section className="panel">
                          <h2>成就印记</h2>
                          <div className="achievements">
                            {[
                              {
                                name: "迈出第一步",
                                text: "完成第一个现实任务",
                                earned: done.length >= 1,
                                icon: Footprints,
                              },
                              {
                                name: "保持好奇",
                                text: "累计完成 5 次探索",
                                earned: done.length >= 5,
                                icon: Sparkles,
                              },
                              {
                                name: "世界的交集",
                                text: "完成一次双方确认的相遇",
                                earned: !!data?.encounters.length,
                                icon: Users,
                              },
                              {
                                name: "城市探索者",
                                text: "完成三站城市探索计划",
                                earned: !!data?.event?.completed,
                                icon: Trophy,
                              },
                            ].map((b) => (
                              <div
                                key={b.name}
                                className={
                                  b.earned
                                    ? "achievement earned"
                                    : "achievement"
                                }
                              >
                                <b.icon size={27} />
                                <h3>{b.name}</h3>
                                <p>{b.text}</p>
                                <span>{b.earned ? "已解锁" : "待探索"}</span>
                              </div>
                            ))}
                          </div>
                        </section>
                      </div>
                      <div className="section-heading lower">
                        <h2>我的收藏</h2>
                        <button
                          className="text-button"
                          onClick={() => navigate("home")}
                        >
                          继续发现 <ChevronRight size={15} />
                        </button>
                      </div>
                      {data?.favorites.length ? (
                        <div className="card-grid">
                          {quests
                            .filter((q) => data.favorites.includes(q.id))
                            .map(card)}
                        </div>
                      ) : (
                        <p className="empty-line">
                          在任务详情中点击收藏，把想做的事留给未来。
                        </p>
                      )}
                      <div className="section-heading lower">
                        <h2>遇见的人</h2>
                      </div>
                      {data?.encounters.length ? (
                        <div className="card-grid">
                          {data.encounters.map((p, i) => (
                            <div className="offer-card person" key={i}>
                              <span className="avatar lilac">{p.name[0]}</span>
                              <div>
                                <h3>{p.name}</h3>
                                <p>
                                  {p.role} · {p.city}
                                </p>
                                <p>
                                  {quests.find((q) => q.id === p.task)?.title} ·{" "}
                                  {date(p.completed)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="empty-line">
                          双方完成真人任务后，这里会留下相遇的记忆。
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </SidebarProvider>
      <Dialog open={onboarding} onOpenChange={setOnboarding}>
        <DialogContent className="game-dialog onboarding">
          <DialogTitle>
            {step === 0
              ? "创建你的探索身份"
              : step === 1
                ? "人生扫描"
                : "你的生活画像"}
          </DialogTitle>
          <DialogDescription>
            {step === 0
              ? "不同的身份，相同的好奇心。"
              : step === 1
                ? "没有标准答案，选择最接近现在的你。"
                : "这是旅程的起点，每次行动都会带来变化。"}
          </DialogDescription>
          <div className="step-indicator">
            {[0, 1, 2].map((i) => (
              <span className={i <= step ? "current" : ""} key={i} />
            ))}
          </div>
          {step === 0 ? (
            <>
              <label className="field">
                你的昵称
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="给探索中的自己起个名字"
                  maxLength={24}
                />
              </label>
              <label className="field">
                探索城市
                <NativeSelect
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                >
                  {Object.keys(cities).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </NativeSelect>
              </label>
              <p className="field-label">选择你的身份</p>
              <RadioGroup
                value={role}
                onValueChange={setRole}
                className="role-grid"
              >
                {roles.map((r, i) => (
                  <label
                    key={r}
                    className={
                      role === r ? "role-option chosen" : "role-option"
                    }
                  >
                    <RadioGroupItem value={r} id={"role-" + i} />
                    <span>{r}</span>
                  </label>
                ))}
              </RadioGroup>
              <button
                className="primary full"
                disabled={!name.trim()}
                onClick={() => setStep(1)}
              >
                下一步：认识自己 <ArrowUpRight size={18} />
              </button>
            </>
          ) : step === 1 ? (
            <>
              <div className="question-list">
                {questions.map((q, i) => (
                  <fieldset key={q.label}>
                    <legend>
                      {i + 1}. {q.label}
                    </legend>
                    <RadioGroup
                      value={String(answers[i])}
                      onValueChange={(v) =>
                        setAnswers((a) =>
                          a.map((x, j) => (i === j ? Number(v) : x)),
                        )
                      }
                      className="answer-grid"
                    >
                      {q.options.map((o, j) => (
                        <label
                          className={
                            answers[i] === j ? "answer chosen" : "answer"
                          }
                          key={o}
                        >
                          <RadioGroupItem value={String(j)} />
                          {o}
                        </label>
                      ))}
                    </RadioGroup>
                  </fieldset>
                ))}
              </div>
              <div className="button-row">
                <button className="outline" onClick={() => setStep(0)}>
                  上一步
                </button>
                <button className="primary grow" onClick={() => setStep(2)}>
                  生成生活画像 <Sparkles size={18} />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="scan-result">
                <Radar values={baseStats(answers)} />
                <h2>{name}，从一个小小的改变开始。</h2>
                <p className="muted">
                  {attributes[answers.indexOf(Math.min(...answers))]}
                  是你下一段旅程的探索方向。
                </p>
                <span className="badge">依据你的 6 项自评生成</span>
              </div>
              <div className="button-row">
                <button className="outline" onClick={() => setStep(1)}>
                  调整答案
                </button>
                <button
                  className="primary grow"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await mutate({
                        action: "profile",
                        name: name.trim(),
                        role,
                        city,
                        answers,
                      })
                    ) {
                      setOnboarding(false);
                      navigate("home");
                      toast.success("档案已保存，你的旅程正式开始");
                    }
                  }}
                >
                  {busy ? "保存中…" : "生成我的任务"} <ArrowUpRight size={18} />
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="game-dialog">
          <DialogTitle>{selected?.title}</DialogTitle>
          <DialogDescription>{selected?.description}</DialogDescription>
          {selected && (
            <>
              <div className="detail-visual">
                <img src="/images/cafe.png" alt="城市中的温暖小店" />
                <span className="badge">
                  {selected.category} · Lv.{selected.kind === "npc" ? 2 : 1}
                </span>
              </div>
              <div className="detail-rewards">
                <span>
                  <Clock size={16} />
                  {selected.minutes} 分钟
                </span>
                <span className="accent">✦ +{selected.xp} XP</span>
                <span>{attributes[selected.attribute]}成长</span>
              </div>
              <h3>这次任务，你需要</h3>
              <ol className="steps">
                {selected.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <a
                className="map-link"
                href={amapLink(
                  profile?.city || "上海",
                  selected.id === "park"
                    ? "公园"
                    : selected.kind === "npc"
                      ? "书店"
                      : selected.id === "cafe"
                        ? "咖啡馆"
                        : "步行街",
                )}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin size={17} />
                在高德寻找合适的地点 <ExternalLink size={15} />
              </a>
              {selected.kind === "npc" && (
                <>
                  <div className="info-box">
                    发起后，同城玩家可以加入。请填写公开场所和见面时间，不要填写私人地址。
                  </div>
                  <label className="field">
                    公开邀请（地点与时间）
                    <input
                      value={invitation}
                      onChange={(e) => setInvitation(e.target.value)}
                      maxLength={100}
                      placeholder="例如：周日下午 3 点，市图书馆一楼大厅"
                    />
                  </label>
                  {!profile?.discoverable && (
                    <button
                      className="outline full"
                      onClick={() => {
                        setSelected(null);
                        navigate("npc");
                      }}
                    >
                      前往开启同城发现
                    </button>
                  )}
                </>
              )}
              <div className="button-row">
                <button
                  className={`outline ${data?.favorites.includes(selected.id) ? "saved" : ""}`}
                  aria-label={
                    data?.favorites.includes(selected.id)
                      ? "取消收藏"
                      : "收藏任务"
                  }
                  disabled={busy}
                  onClick={() => void toggleFavorite(selected)}
                >
                  <Bookmark size={19} />
                  {data?.favorites.includes(selected.id) ? "已收藏" : "收藏"}
                </button>
                <button
                  className="primary grow"
                  disabled={
                    busy ||
                    !!active ||
                    done.some(
                      (r) => r.task === selected.id && r.day === dayKey(),
                    ) ||
                    (selected.kind === "npc" &&
                      !!profile &&
                      (!profile.discoverable || invitation.trim().length < 5))
                  }
                  onClick={() => void accept(selected)}
                >
                  {active
                    ? "已有任务进行中"
                    : done.some(
                          (r) => r.task === selected.id && r.day === dayKey(),
                        )
                      ? "今日已完成"
                      : !profile
                        ? "建立档案并开始"
                        : selected.kind === "npc"
                          ? "发布真人邀请"
                          : "接受任务"}{" "}
                  <ArrowUpRight size={18} />
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="game-dialog result-dialog">
          <DialogTitle>世界发生了轻微偏移</DialogTitle>
          <DialogDescription>
            你迈出了一小步，生活多了一种可能。
          </DialogDescription>
          <div className="success-emblem">
            <Compass size={64} />
            <Sparkles size={22} />
          </div>
          <span className="eyebrow">QUEST COMPLETED</span>
          <h2>{result?.title}</h2>
          <div className="result-rewards">
            <div>
              <span>探索经验</span>
              <strong>+{result?.xp} XP</strong>
            </div>
            <div>
              <span>成长方向</span>
              <strong>{attributes[result?.attribute || 0]}</strong>
            </div>
            <div>
              <span>累计完成</span>
              <strong>{done.length} 次</strong>
            </div>
          </div>
          <a
            className="primary full"
            href={"/?publish=" + encodeURIComponent(result?.title || "")}
          >
            发布类似任务，邀请更多人参与
          </a>
          <button
            className="primary full"
            onClick={() => {
              setResult(null);
              navigate("profile");
            }}
          >
            查看成长档案 <ArrowUpRight size={18} />
          </button>
          <button
            className="text-button centered"
            onClick={() => {
              setResult(null);
              navigate("home");
            }}
          >
            继续探索
          </button>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent className="game-dialog">
          <AlertDialogTitle>结束这次任务？</AlertDialogTitle>
          <AlertDialogDescription>
            已保存的记录会保留，不扣除经验。双方未完成的真人任务会一并结束，你可以重新开始。
          </AlertDialogDescription>
          <div className="button-row">
            <button className="outline" onClick={() => setConfirmCancel(false)}>
              继续任务
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                if (
                  active &&
                  (await mutate({ action: "cancel", run: active.id }))
                ) {
                  setConfirmCancel(false);
                  toast.success("任务已结束，按自己的节奏继续");
                }
              }}
            >
              确认结束
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={!!archive} onOpenChange={(o) => !o && setArchive(null)}>
        <DialogContent className="game-dialog">
          <DialogTitle>
            {quests.find((q) => q.id === archive?.task)?.title || "探索记录"}
          </DialogTitle>
          <DialogDescription>
            {archive
              ? `${date(archive.completed || archive.started)} · ${archive.place || "未记录地点"}`
              : ""}
          </DialogDescription>
          <p className="journal-note">
            {archive?.note || "这次没有留下文字记录。"}
          </p>
          {archive?.location && (
            <p className="small muted">已保存私人定位信息</p>
          )}
          <div className="attachments archive">
            {data?.media
              .filter((m) => m.run === archive?.id)
              .map((m) =>
                m.type.startsWith("image") ? (
                  <a
                    key={m.id}
                    href={"/api/media?id=" + m.id}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img src={"/api/media?id=" + m.id} alt="探索照片" />
                  </a>
                ) : (
                  <audio key={m.id} controls src={"/api/media?id=" + m.id} />
                ),
              )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="game-dialog">
          <DialogTitle>设置与更多</DialogTitle>
          <DialogDescription>让探索适合你的节奏。</DialogDescription>
          <div className="setting-row">
            <div>
              <h3>个人资料与探索城市</h3>
              <p>
                {profile ? `${profile.name} · ${profile.city}` : "尚未建立档案"}
              </p>
            </div>
            <button
              className="text-button"
              onClick={() => {
                setSettings(false);
                begin();
              }}
            >
              编辑 <ChevronRight size={15} />
            </button>
          </div>
          <div className="setting-row">
            <div>
              <h3>同城发现</h3>
              <p>公开昵称、身份、城市与邀请</p>
            </div>
            <Switch
              aria-label="设置同城发现"
              checked={!!profile?.discoverable}
              disabled={busy || !profile}
              onCheckedChange={(v) =>
                void mutate({ action: "settings", discoverable: v })
              }
            />
          </div>
          <div className="setting-row">
            <div>
              <h3>浅色模式</h3>
              <p>仅保存在当前设备</p>
            </div>
            <Switch
              aria-label="浅色模式"
              checked={theme}
              onCheckedChange={(v) => {
                setTheme(v);
                localStorage.setItem("life-npc-light", String(v));
                document.documentElement.classList.toggle("light", v);
              }}
            />
          </div>
          <div className="setting-row">
            <div>
              <h3>导出我的旅程</h3>
              <p>下载档案和文字记录（JSON）</p>
            </div>
            <button
              className="icon-button"
              aria-label="导出我的旅程"
              disabled={!profile}
              onClick={() => {
                const safe = {
                  profile,
                  runs: data?.runs,
                  favorites: data?.favorites,
                  event: data?.event,
                };
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(safe, null, 2)], {
                    type: "application/json",
                  }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "人生NPC-我的旅程.json";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              <Download size={20} />
            </button>
          </div>
          <div className="info-box">
            <Shield size={18} />
            照片、语音、文字和精确定位仅自己可见。定位与录音只在你主动点击时请求权限。
          </div>
          <p className="small muted">
            人生 NPC v1.0 · 地图服务：高德地图
            <br />
            当前体验通过站点登录识别玩家。
          </p>
          <a className="outline full" href="/" target="_top">
            退出当前登录
          </a>
        </DialogContent>
      </Dialog>
    </>
  );
}
