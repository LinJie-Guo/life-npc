/* Native links also support the standalone SPA runtime. */
/* eslint-disable @next/next/no-img-element */
"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Compass,
  LayoutGrid,
  Footprints,
  Send,
  UserRound,
  Plus,
  Search,
  MapPin,
  ArrowUpRight,
  CheckCircle2,
  RefreshCw,
  LogOut,
  ShieldCheck,
  FileText,
  ChevronRight,
  LoaderCircle,
  Trophy,
  Map,
  CalendarDays,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Toaster, toast } from "sonner";
import type {
  CommunityState,
  CommunityTask,
  TaskDetail,
} from "@/lib/community-types";
import { categories, cities, api } from "@/lib/community-client";
import Auth from "@/components/life/auth";
import TaskEditor from "@/components/life/task-editor";
import TaskCard from "@/components/life/task-card";
import Detail from "@/components/life/task-detail";
import "./community.css";
export default function Home() {
  const [state, setState] = useState<CommunityState | null>(null),
    [unauth, setUnauth] = useState(false),
    [error, setError] = useState(""),
    [view, setView] = useState("square"),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("全部类型"),
    [city, setCity] = useState("全部城市"),
    [detail, setDetail] = useState<TaskDetail | null>(null),
    [editor, setEditor] = useState<CommunityTask | { title: string } | null>(
      null,
    ),
    [settings, setSettings] = useState(false),
    [passwordBusy, setPasswordBusy] = useState(false),
    [tick, setTick] = useState(() => Date.now()),
    [loadingDetail, setLoadingDetail] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const d = await api<CommunityState>("community");
      setState(d);
      setUnauth(false);
      setError("");
    } catch (e) {
      if ((e as { status: number }).status === 401) setUnauth(true);
      else setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(refresh);
    const t = setInterval(() => setTick(Date.now()), 30000);
    return () => clearInterval(t);
  }, [refresh]);
  useEffect(() => {
    const title = new URLSearchParams(location.search).get("publish");
    if (title) {
      queueMicrotask(() => setEditor({ title }));
      history.replaceState(null, "", "/");
    }
  }, []);
  async function open(t: CommunityTask) {
    setLoadingDetail(true);
    try {
      setDetail(await api<TaskDetail>("community/" + t.id));
      window.scrollTo({ top: 0 });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingDetail(false);
    }
  }
  const nav = [
    { id: "square", label: "任务广场", icon: LayoutGrid },
    { id: "joined", label: "我参与的", icon: Footprints },
    { id: "published", label: "我发布的", icon: Send },
    { id: "profile", label: "成长档案", icon: UserRound },
  ];
  function navigate(v: string) {
    setView(v);
    setDetail(null);
    setFilter("all");
    window.scrollTo({ top: 0 });
  }
  if (unauth) return <Auth onSuccess={() => void refresh()} />;
  if (!state)
    return (
      <main className="np-loading">
        <Compass size={40} />
        <h2>{error ? "暂时无法连接" : "正在整理你的旅程"}</h2>
        <p>{error || "下一段故事，很快开始。"}</p>
        {error && (
          <button className="np-button" onClick={() => void refresh()}>
            <RefreshCw size={17} />
            重新连接
          </button>
        )}
      </main>
    );
  const allTasks = state.tasks.filter((t) =>
    view === "published"
      ? t.owner === state.user.id
      : view === "joined"
        ? !!t.my_id
        : t.status !== "draft" && t.status !== "cancelled",
  );
  const tasks = allTasks.filter(
    (t) =>
      (!query ||
        [t.title, t.description, t.place, t.owner_name].some((x) =>
          x.includes(query),
        )) &&
      (category === "全部类型" || t.category === category) &&
      (city === "全部城市" || t.city === city) &&
      (filter === "all" ||
        (filter === "open" &&
          t.owner !== state.user.id &&
          (!t.my_id || t.my_status === "withdrawn") &&
          t.status === "open" &&
          t.deadline > tick &&
          t.joined_count < t.capacity) ||
        (filter === "draft" && t.status === "draft") ||
        (filter === "pending" &&
          (view === "published"
            ? t.pending_count > 0
            : t.my_status === "submitted")) ||
        (filter === "active" &&
          ["joined", "rejected"].includes(t.my_status || "")) ||
        (filter === "completed" &&
          (view === "published"
            ? ["closed", "finished", "cancelled"].includes(t.status)
            : t.my_status === "approved"))),
  );
  const level = Math.floor(state.xp / 100) + 1;
  return (
    <div className="np-app" data-clock={tick}>
      <aside className="np-sidebar">
        <a className="np-brand" href="/">
          <Compass />
          <span>
            人生 NPC<small>把生活变成一场探索</small>
          </span>
        </a>
        <div className="np-workspace-label">我的探索空间</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "active" : ""}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={20} />
              {n.label}
              {n.id === "published" && state.stats.pending > 0 && (
                <b>{state.stats.pending}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="np-sidebar-divider" />
        <a className="np-side-link" href="/explore">
          <Compass size={19} />
          个人探索与真人邀请
          <ArrowUpRight size={15} />
        </a>
        <a className="np-side-link" href="/explore#map">
          <Map size={19} />
          探索地图
          <ArrowUpRight size={15} />
        </a>
        <div className="np-sidebar-tip">
          <span>发起一件小事</span>
          <p>
            你也可以成为
            <br />
            别人的故事起点。
          </p>
          <button onClick={() => setEditor({ title: "" })}>
            发布新任务 <Plus size={16} />
          </button>
        </div>
        <button className="np-user-card" onClick={() => navigate("profile")}>
          <i>{state.user.name[0]}</i>
          <span>
            {state.user.name}
            <small>Lv.{level} · 探索者</small>
          </span>
          <ChevronRight size={16} />
        </button>
      </aside>
      <div className="np-workspace">
        <header className="np-topbar">
          <span>
            <span className="np-top-product">人生 NPC / </span>
            {detail ? "任务详情" : nav.find((n) => n.id === view)?.label}
          </span>
          <div>
            <span className="np-city">
              <MapPin size={16} />
              {state.user.city}
            </span>
            <button
              className="np-icon-button"
              onClick={() => {
                void refresh();
                if (detail) void open(detail.task);
              }}
              aria-label="刷新数据"
            >
              <RefreshCw size={18} />
            </button>
            <button
              className="np-button"
              onClick={() => setEditor({ title: "" })}
            >
              <Plus size={18} />
              发布任务
            </button>
          </div>
        </header>
        <main className="np-main">
          {error && (
            <p className="np-error" role="alert">
              {error}
            </p>
          )}
          {loadingDetail && (
            <div className="np-inline-loading">
              <LoaderCircle className="spin" size={18} />
              正在读取任务详情
            </div>
          )}
          {detail ? (
            <Detail
              key={detail.task.id}
              value={detail}
              userId={state.user.id}
              onRefresh={(d) => {
                setDetail(d);
                void refresh();
              }}
              onBack={() => setDetail(null)}
              onCopy={() => setEditor({ ...detail.task, status: "open" })}
              onEdit={() => setEditor(detail.task)}
            />
          ) : view === "profile" ? (
            <>
              <div className="np-page-heading">
                <div>
                  <span className="np-kicker">YOUR JOURNEY</span>
                  <h1>每一步，都算数。</h1>
                  <p>那些真实做过的小事，正在成为你的成长。</p>
                </div>
                <button
                  className="np-button secondary"
                  onClick={() => setSettings(true)}
                >
                  <ShieldCheck size={18} />
                  账号安全
                </button>
              </div>
              <div className="np-profile-grid">
                <section className="np-profile-card">
                  <div className="np-large-avatar">{state.user.name[0]}</div>
                  <h2>{state.user.name}</h2>
                  <p>
                    @{state.user.username} · {state.user.city}
                  </p>
                  <span className="np-tag open">Lv.{level} 探索者</span>
                  <div className="np-level">
                    <strong>{state.xp} XP</strong>
                    <span>
                      距离 Lv.{level + 1} 还需 {100 - (state.xp % 100)} XP
                    </span>
                  </div>
                  <Progress value={state.xp % 100} />
                  <a
                    className="np-button secondary full"
                    href="/explore#profile"
                  >
                    编辑档案与查看能力成长
                    <ArrowUpRight size={17} />
                  </a>
                </section>
                <section className="np-growth-panel">
                  <h2>让行动留下痕迹</h2>
                  <div className="np-stats">
                    <div>
                      <strong>{state.stats.approved}</strong>
                      <span>完成社区任务</span>
                    </div>
                    <div>
                      <strong>{state.stats.published}</strong>
                      <span>发起任务</span>
                    </div>
                    <div>
                      <strong>{state.stats.joined}</strong>
                      <span>正在参与</span>
                    </div>
                  </div>
                  <div className="np-info">
                    <Trophy />
                    <p>
                      社区任务通过验收获得 20 XP；个人探索按任务奖励成长值。每
                      100 XP 提升一级。
                    </p>
                  </div>
                  <h3>最近完成</h3>
                  {state.tasks
                    .filter((t) => t.my_status === "approved")
                    .slice(0, 5)
                    .map((t) => (
                      <button
                        className="np-history-task"
                        key={t.id}
                        onClick={() => void open(t)}
                      >
                        <CheckCircle2 />
                        <span>
                          {t.title}
                          <small>{t.city}</small>
                        </span>
                        <strong>+{t.reward} XP</strong>
                        <ChevronRight size={17} />
                      </button>
                    ))}
                  {!state.tasks.some((t) => t.my_status === "approved") && (
                    <p className="np-muted">
                      还没有完成社区任务。选一件感兴趣的小事，从今天开始。
                    </p>
                  )}
                  <button
                    className="np-link"
                    onClick={() => navigate("square")}
                  >
                    去任务广场 <ArrowUpRight size={17} />
                  </button>
                </section>
              </div>
            </>
          ) : (
            <>
              <div className="np-page-heading">
                <div>
                  <span className="np-kicker">
                    {view === "square"
                      ? "A LITTLE ADVENTURE, EVERY DAY"
                      : view === "joined"
                        ? "MAKE IT HAPPEN"
                        : "START SOMETHING GOOD"}
                  </span>
                  <h1>
                    {view === "square"
                      ? "今天，想做点什么？"
                      : view === "joined"
                        ? "把想做的，变成做过的。"
                        : "让好故事，从你开始。"}
                  </h1>
                  <p>
                    {view === "square"
                      ? "发现城市里的小事，遇见一起行动的人。"
                      : view === "joined"
                        ? "报名、行动、提交记录。每一步都在这里。"
                        : "管理你的任务，看看大家的发现，为每次行动认真验收。"}
                  </p>
                </div>
                <div className="np-heading-date">
                  <CalendarDays size={20} />
                  {new Intl.DateTimeFormat("zh-CN", {
                    month: "long",
                    day: "numeric",
                    weekday: "short",
                  }).format(new Date())}
                </div>
              </div>
              {view === "square" && (
                <div className="np-square-banner">
                  <div>
                    <span className="np-kicker">从一次小小的尝试开始</span>
                    <h2>探索生活，也发起相遇。</h2>
                    <p>
                      完成任务后，可以把自己的发现变成新任务。
                      <br />
                      一个人出发，也能和更多人一起完成。
                    </p>
                    <a href="/explore" className="np-button">
                      从个人探索开始 <ArrowUpRight size={17} />
                    </a>
                  </div>
                  <img
                    src="/images/cafe.png"
                    alt="街角咖啡店，等待下一位探索者"
                  />
                  <span className="np-banner-note">
                    <MapPin size={14} />
                    灵感，往往就在下一条街
                  </span>
                </div>
              )}
              {view === "published" && (
                <div className="np-publisher-summary">
                  <span>
                    <Send size={20} />
                    <strong>{state.stats.published}</strong>已发布
                  </span>
                  <span>
                    <FileText size={20} />
                    <strong>{state.stats.pending}</strong>待验收
                  </span>
                  <p>先处理提交，再开始下一段故事。</p>
                </div>
              )}
              <section className="np-task-section">
                <div className="np-section-heading">
                  <h2>
                    {view === "square"
                      ? "发现新任务"
                      : view === "joined"
                        ? "我的参与记录"
                        : "任务管理"}
                    <span>{allTasks.length}</span>
                  </h2>
                  <Tabs value={filter} onValueChange={setFilter}>
                    <TabsList className="np-filter-tabs">
                      <TabsTrigger value="all">全部</TabsTrigger>
                      {view === "square" ? (
                        <TabsTrigger value="open">可报名</TabsTrigger>
                      ) : view === "joined" ? (
                        <>
                          <TabsTrigger value="active">进行中</TabsTrigger>
                          <TabsTrigger value="pending">待验收</TabsTrigger>
                          <TabsTrigger value="completed">已完成</TabsTrigger>
                        </>
                      ) : (
                        <>
                          <TabsTrigger value="draft">草稿</TabsTrigger>
                          <TabsTrigger value="pending">待验收</TabsTrigger>
                          <TabsTrigger value="completed">已结束</TabsTrigger>
                        </>
                      )}
                    </TabsList>
                  </Tabs>
                </div>
                <div className="np-filters">
                  <label className="np-search">
                    <Search size={18} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="搜索任务、地点或发起人"
                      aria-label="搜索任务"
                    />
                  </label>
                  <NativeSelect
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    aria-label="筛选任务类型"
                  >
                    <option>全部类型</option>
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </NativeSelect>
                  <NativeSelect
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    aria-label="筛选城市"
                  >
                    <option>全部城市</option>
                    {cities.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </NativeSelect>
                </div>
                {tasks.length ? (
                  <div className="np-task-grid">
                    {tasks.map((t) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        onClick={() => void open(t)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="np-empty">
                    <Compass />
                    <h3>
                      {query ||
                      filter !== "all" ||
                      category !== "全部类型" ||
                      city !== "全部城市"
                        ? "没有符合条件的任务"
                        : view === "joined"
                          ? "还没有参与任务"
                          : view === "published"
                            ? "你的第一个邀请，从这里开始"
                            : "这座城市，等你发起第一段故事"}
                    </h3>
                    <p>
                      {view === "joined"
                        ? "去广场选一件感兴趣的小事，也可以先尝试个人探索。"
                        : "约一次散步，发现一家小店，或者交换一本书。"}
                    </p>
                    <div className="np-actions">
                      {view === "joined" ? (
                        <button
                          className="np-button"
                          onClick={() => navigate("square")}
                        >
                          发现任务
                          <ArrowUpRight size={17} />
                        </button>
                      ) : (
                        <button
                          className="np-button"
                          onClick={() => setEditor({ title: "" })}
                        >
                          <Plus size={17} />
                          发布第一个任务
                        </button>
                      )}
                      <a className="np-button secondary" href="/explore">
                        个人探索
                      </a>
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
        </main>
        <footer className="np-footer">
          人生 NPC <span>让每一次真实行动，都留下回响。</span>
        </footer>
      </div>
      <nav className="np-mobile-nav">
        {nav.map((n) => (
          <button
            key={n.id}
            className={view === n.id ? "active" : ""}
            onClick={() => navigate(n.id)}
          >
            <n.icon size={21} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
      {editor && (
        <TaskEditor
          city={state.user.city}
          initial={editor}
          onClose={() => setEditor(null)}
          onDone={(d) => {
            setEditor(null);
            setDetail(d);
            setView("published");
            void refresh();
          }}
        />
      )}
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="np-dialog">
          <DialogTitle>账号安全</DialogTitle>
          <DialogDescription>修改密码会退出其他设备的登录。</DialogDescription>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPasswordBusy(true);
              const data = Object.fromEntries(new FormData(e.currentTarget));
              try {
                await api("auth/password", data);
                toast.success("密码已更新，其他设备已退出");
                setSettings(false);
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setPasswordBusy(false);
              }
            }}
          >
            <label>
              当前密码
              <input
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
            <label>
              新密码
              <input
                name="password"
                type="password"
                minLength={10}
                maxLength={128}
                required
                autoComplete="new-password"
              />
            </label>
            <button className="np-button full" disabled={passwordBusy}>
              修改密码
            </button>
          </form>
          <button
            className="np-button secondary full"
            onClick={async () => {
              try {
                await api("auth/logout", {});
                setState(null);
                setSettings(false);
                setUnauth(true);
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <LogOut size={17} />
            退出当前账号
          </button>
        </DialogContent>
      </Dialog>
      <Toaster richColors position="top-center" />
    </div>
  );
}
