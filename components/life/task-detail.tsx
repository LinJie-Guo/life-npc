/* Native links also support the standalone SPA runtime. */
/* eslint-disable @next/next/no-img-element */
"use client";
import { useEffect, useState } from "react";
import {
  Send,
  Plus,
  MapPin,
  Clock,
  Users,
  ArrowUpRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  ShieldCheck,
  FileText,
  MessageSquare,
  Copy,
  Trophy,
  ImagePlus,
  CalendarDays,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import type { TaskDetail, Participation } from "@/lib/community-types";
import {
  statusNames,
  historyNames,
  date,
  remaining,
  api,
} from "@/lib/community-client";
export default function Detail({
  value,
  userId,
  onRefresh,
  onBack,
  onCopy,
  onEdit,
}: {
  value: TaskDetail;
  userId: string;
  onRefresh: (d: TaskDetail) => void;
  onBack: () => void;
  onCopy: () => void;
  onEdit: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [note, setNote] = useState(
      value.participations.find((p) => p.user === userId)?.note || "",
    ),
    [confirmed, setConfirmed] = useState(false),
    [feedback, setFeedback] = useState<Record<string, string>>({}),
    [confirm, setConfirm] = useState<"cancel" | "withdraw" | "close" | null>(
      null,
    ),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  const t = value.task,
    owner = t.owner === userId,
    mine = value.participations.find((p) => p.user === userId),
    before = t.deadline > now,
    writable =
      mine &&
      ["joined", "rejected"].includes(mine.status) &&
      before &&
      t.status !== "cancelled";
  async function act(body: unknown) {
    setBusy(true);
    setError("");
    try {
      const d = await api<TaskDetail>("community/" + t.id, body);
      onRefresh(d);
      setConfirm(null);
      toast.success("已保存");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File | undefined) {
    if (!file || !mine) return;
    setBusy(true);
    setError("");
    try {
      const f = new FormData();
      f.set("file", file);
      f.set("run", mine.id);
      const res = await fetch("/api/media", { method: "POST", body: f });
      const data = (await res.json()) as { error: string };
      if (!res.ok) throw new Error(data.error);
      onRefresh(await api<TaskDetail>("community/" + t.id));
      toast.success("附件已保存");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function files(p: Participation) {
    return (
      <div className="np-files">
        {value.attachments
          .filter((m) => m.run === p.id)
          .map((m) =>
            m.type.startsWith("image/") ? (
              <a
                key={m.id}
                href={"/api/media?id=" + m.id}
                target="_blank"
                rel="noreferrer"
              >
                <img
                  src={"/api/media?id=" + m.id}
                  alt={`${p.name}的任务照片`}
                />
              </a>
            ) : (
              <audio key={m.id} controls src={"/api/media?id=" + m.id} />
            ),
          )}
      </div>
    );
  }
  return (
    <>
      <button className="np-link np-back" onClick={onBack}>
        <ArrowLeft size={17} />
        返回任务列表
      </button>
      <div className="np-detail-layout">
        <article className="np-detail-main">
          <div className="np-detail-title">
            <div className="np-card-top">
              <span className="np-category">{t.category}</span>
              <span className={"np-tag " + t.status}>
                {statusNames[t.status]}
              </span>
            </div>
            <h1>{t.title}</h1>
            <div className="np-owner">
              <i>{t.owner_name[0]}</i>
              {t.owner_name} 发起 <span>· {date(t.created)}</span>
            </div>
          </div>
          <section>
            <h2>这次一起做什么</h2>
            <p className="np-preline">{t.description}</p>
          </section>
          <section>
            <h2>
              <CheckCircle2 size={20} />
              完成要求
            </h2>
            <p className="np-preline np-requirements">{t.requirements}</p>
          </section>
          <div className="np-detail-facts">
            <div>
              <MapPin />
              <span>
                活动地点
                <strong>
                  {t.city} · {t.place}
                </strong>
              </span>
            </div>
            <div>
              <CalendarDays />
              <span>
                提交截止 · 北京时间<strong>{date(t.deadline)}</strong>
              </span>
            </div>
          </div>
          {t.status === "cancelled" && (
            <div className="np-info warning">取消原因：{t.cancel_reason}</div>
          )}
          {owner && (
            <section className="np-submissions">
              <h2>
                <FileText size={20} />
                参与与验收{" "}
                <span>
                  {
                    value.participations.filter((p) => p.status === "submitted")
                      .length
                  }{" "}
                  份待验收
                </span>
              </h2>
              <p className="np-muted">
                每位参与者独立验收。通过后自动发放成长值，不会重复发放。
              </p>
              {value.participations.length === 0 ? (
                <div className="np-empty compact">
                  <Users />
                  <h3>还没有人报名</h3>
                  <p>任务发布后，其他探索者可在广场找到它。</p>
                </div>
              ) : (
                value.participations.map((p) => (
                  <div className="np-submission" key={p.id}>
                    <header>
                      <strong>{p.name}</strong>
                      <span className={"np-tag " + p.status}>
                        {statusNames[p.status]}
                      </span>
                    </header>
                    <small>
                      {p.submitted
                        ? "提交于 " + date(p.submitted)
                        : "报名于 " + date(p.joined)}
                    </small>
                    {p.note && <p className="np-preline">{p.note}</p>}
                    {files(p)}
                    {p.feedback && (
                      <div className="np-feedback">验收意见：{p.feedback}</div>
                    )}
                    {p.status === "submitted" && (
                      <>
                        <label className="np-review-label">
                          验收意见
                          <textarea
                            value={feedback[p.id] || ""}
                            onChange={(e) =>
                              setFeedback((f) => ({
                                ...f,
                                [p.id]: e.target.value,
                              }))
                            }
                            maxLength={500}
                            rows={2}
                            placeholder="通过可选填；退回时请说明需要补充什么。"
                          />
                        </label>
                        <div className="np-actions">
                          <button
                            className="np-button secondary"
                            disabled={busy}
                            onClick={() =>
                              void act({
                                action: "review",
                                participation: p.id,
                                decision: "rejected",
                                feedback: feedback[p.id] || "",
                              })
                            }
                          >
                            退回补充
                          </button>
                          <button
                            className="np-button"
                            disabled={busy}
                            onClick={() =>
                              void act({
                                action: "review",
                                participation: p.id,
                                decision: "approved",
                                feedback: feedback[p.id] || "",
                              })
                            }
                          >
                            <Check size={17} />
                            通过验收
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </section>
          )}
          {mine && (
            <section className="np-my-submission">
              <h2>
                <FileText size={20} />
                我的完成记录{" "}
                <span className={"np-tag " + mine.status}>
                  {statusNames[mine.status]}
                </span>
              </h2>
              {mine.feedback && (
                <div className="np-feedback">
                  <MessageSquare size={17} />
                  发布者反馈：{mine.feedback}
                  {!before && mine.status === "rejected" && (
                    <p>截止时间已过，无法再次提交。</p>
                  )}
                </div>
              )}
              {writable ? (
                <>
                  <label>
                    写下你的完成过程
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={5}
                      minLength={10}
                      maxLength={2000}
                      placeholder="对照完成要求，记录你的行动与发现。至少 10 个字。"
                    />
                  </label>
                  {files(mine)}
                  <label className="np-upload">
                    <ImagePlus size={20} />
                    添加照片或录音 <span>最多 6 个，每个 5 MB</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,audio/webm,audio/mp4,audio/ogg"
                      disabled={busy}
                      onChange={(e) => {
                        void upload(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <label className="np-check">
                    <Checkbox
                      checked={confirmed}
                      onCheckedChange={(v) => setConfirmed(v === true)}
                    />
                    我已实际完成任务，提交内容真实
                  </label>
                  <div className="np-actions">
                    <button
                      className="np-button secondary"
                      disabled={busy}
                      onClick={() =>
                        void act({ action: "draft_submission", note })
                      }
                    >
                      保存草稿
                    </button>
                    <button
                      className="np-button"
                      disabled={busy || !confirmed || note.trim().length < 10}
                      onClick={() =>
                        void act({ action: "submit", note, confirmed: true })
                      }
                    >
                      <Send size={17} />
                      提交验收
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="np-preline">
                    {mine.note || "还没有提交完成记录。"}
                  </p>
                  {files(mine)}
                  {mine.status === "submitted" && (
                    <div className="np-info">
                      已提交，等待发布者验收。截止后仍可验收，记录已保留。
                    </div>
                  )}
                  {mine.status === "approved" && (
                    <div className="np-complete">
                      <Trophy />
                      <h3>完成了！+{t.reward} XP</h3>
                      <p>把这次体验变成新的邀请，让故事继续。</p>
                      <button className="np-button" onClick={onCopy}>
                        <Plus size={17} />
                        发布类似任务
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
          <section className="np-history">
            <h2>任务动态</h2>
            {value.history.map((h) => (
              <div key={h.id}>
                <i />
                <p>
                  <strong>{historyNames[h.action] || h.action}</strong>
                  {h.detail && <span>{h.detail}</span>}
                </p>
                <time>{date(h.created)}</time>
              </div>
            ))}
          </section>
        </article>
        <aside className="np-detail-side">
          <div className="np-join-card">
            <div className="np-reward">
              <Trophy size={25} />
              <strong>
                {t.reward}
                <span>XP / 人</span>
              </strong>
            </div>
            <p>完成并通过验收后获得成长值</p>
            <div className="np-slot-row">
              <Users size={18} />
              <strong>{t.joined_count}</strong> / {t.capacity} 人参与
            </div>
            <Progress value={(t.joined_count / t.capacity) * 100} />
            <div className="np-time-row">
              <Clock size={17} />
              {remaining(t.deadline)}
            </div>
            {owner ? (
              <>
                <span className="np-muted">你是这个任务的发布者</span>
                {t.status === "draft" && (
                  <>
                    <button
                      className="np-button full"
                      disabled={busy}
                      onClick={() => void act({ action: "publish" })}
                    >
                      发布任务
                    </button>
                    <button
                      className="np-button secondary full"
                      onClick={onEdit}
                    >
                      编辑草稿
                    </button>
                  </>
                )}
                {t.status === "open" && (
                  <button
                    className="np-button secondary full"
                    disabled={busy}
                    onClick={() => setConfirm("close")}
                  >
                    停止招募
                  </button>
                )}
                {!["cancelled", "finished"].includes(t.status) && (
                  <button
                    className="np-link danger"
                    disabled={busy}
                    onClick={() => setConfirm("cancel")}
                  >
                    取消任务
                  </button>
                )}
              </>
            ) : !mine || mine.status === "withdrawn" ? (
              <button
                className="np-button full"
                disabled={
                  busy ||
                  t.status !== "open" ||
                  !before ||
                  t.joined_count >= t.capacity
                }
                onClick={() => void act({ action: "join" })}
              >
                {t.status !== "open" || !before
                  ? "报名已结束"
                  : t.joined_count >= t.capacity
                    ? "名额已满"
                    : "报名参加"}
                <ArrowUpRight size={18} />
              </button>
            ) : (
              <>
                <div className={"np-tag " + mine.status}>
                  {statusNames[mine.status]}
                </div>
                {["joined", "rejected"].includes(mine.status) && (
                  <button
                    className="np-link"
                    disabled={busy}
                    onClick={() => setConfirm("withdraw")}
                  >
                    退出这次任务
                  </button>
                )}
              </>
            )}
            <button className="np-button secondary full" onClick={onCopy}>
              <Copy size={16} />
              以此为模板发布
            </button>
          </div>
          <div className="np-side-note">
            <ShieldCheck size={20} />
            <h3>每个人都有自己的进度</h3>
            <p>
              报名占用一个名额。提交后等待验收，退回可在截止前补充。已完成的记录会一直保留。
            </p>
          </div>
        </aside>
      </div>
      {error && (
        <div className="np-floating-error" role="alert">
          {error}
          <button aria-label="关闭错误提示" onClick={() => setError("")}>
            <X size={17} />
          </button>
        </div>
      )}
      <Dialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <DialogContent className="np-dialog">
          <DialogTitle>
            {confirm === "cancel"
              ? "取消这个任务？"
              : confirm === "close"
                ? "停止接受新报名？"
                : "退出这次任务？"}
          </DialogTitle>
          <DialogDescription>
            {confirm === "cancel"
              ? "未完成的参与记录会标为取消，已验收的成果和成长值会保留。请先处理所有待验收记录。"
              : confirm === "close"
                ? "不再接受新的参与者。已经报名的人仍可以在截止前提交。"
                : "退出后释放名额，已保存的草稿仍保留；招募结束前可以重新报名。"}
          </DialogDescription>
          {confirm === "cancel" && (
            <label>
              取消原因
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
                placeholder="请给参与者一个说明"
              />
            </label>
          )}
          <div className="np-actions">
            <button
              className="np-button secondary"
              onClick={() => setConfirm(null)}
            >
              再想想
            </button>
            <button
              className="np-button"
              disabled={
                busy || (confirm === "cancel" && reason.trim().length < 5)
              }
              onClick={() =>
                void act(
                  confirm === "cancel"
                    ? { action: "cancel", reason }
                    : { action: confirm },
                )
              }
            >
              确认
            </button>
          </div>
          {error && <p className="np-error">{error}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
