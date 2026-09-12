/* Native links also support the standalone SPA runtime. */
"use client";
import { useState } from "react";
import { Send, LoaderCircle, Trophy, Bookmark } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { toast } from "sonner";
import type { CommunityTask, TaskDetail } from "@/lib/community-types";
import { categories, cities, api } from "@/lib/community-client";
type TaskForm = {
  title: string;
  description: string;
  requirements: string;
  category: string;
  city: string;
  place: string;
  deadline: string;
  capacity: number;
};
function localDate(n: number) {
  const d = new Date(n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export default function TaskEditor({
  city,
  initial,
  onDone,
  onClose,
}: {
  city: string;
  initial?: CommunityTask | { title: string };
  onDone: (d: TaskDetail) => void;
  onClose: () => void;
}) {
  const editing = initial && "id" in initial && initial.status === "draft";
  const full = initial && "description" in initial ? initial : undefined;
  const [form, setForm] = useState<TaskForm>(() => ({
    title: initial?.title || "",
    description: full?.description || "",
    requirements: full?.requirements || "",
    category: full?.category || "城市探索",
    city: full?.city || city,
    place: full?.place || "",
    deadline: localDate(editing ? full!.deadline : Date.now() + 7 * 86400000),
    capacity: full?.capacity || 6,
  }));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function set<K extends keyof TaskForm>(key: K, value: TaskForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  async function save(action: "draft" | "publish") {
    setBusy(true);
    setError("");
    try {
      const payload = { ...form, deadline: new Date(form.deadline).getTime() };
      let d = await api<TaskDetail>(
        "community" + (editing ? "/" + initial.id : ""),
        { ...payload, action: editing ? "edit" : action },
      );
      if (editing && action === "publish")
        d = await api<TaskDetail>("community/" + initial.id, {
          action: "publish",
        });
      onDone(d);
      toast.success(
        action === "publish" ? "任务已发布，等待新的相遇" : "草稿已保存",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="np-dialog np-editor">
        <DialogTitle>{editing ? "编辑任务草稿" : "发起一个新任务"}</DialogTitle>
        <DialogDescription>
          把你想做的事变成邀请，让更多人一起参与。
        </DialogDescription>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save("publish");
          }}
        >
          <label>
            任务标题 <span>一句话说清要做什么</span>
            <input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              required
              minLength={4}
              maxLength={60}
              placeholder="例如：一起收集城市里的三种绿色"
            />
          </label>
          <label>
            任务描述
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              required
              minLength={10}
              maxLength={2000}
              rows={3}
              placeholder="介绍活动内容、适合谁参加，以及需要提前准备什么。"
            />
          </label>
          <label>
            完成要求 <span>发布后将固定，方便公平验收</span>
            <textarea
              value={form.requirements}
              onChange={(e) => set("requirements", e.target.value)}
              required
              minLength={5}
              maxLength={1000}
              rows={3}
              placeholder="例如：找到三种绿色植物，上传照片并写下你的发现。"
            />
          </label>
          <div className="np-form-grid">
            <label>
              任务类型
              <NativeSelect
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </NativeSelect>
            </label>
            <label>
              所在城市
              <NativeSelect
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              >
                {cities.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </NativeSelect>
            </label>
          </div>
          <label>
            公开活动地点
            <input
              value={form.place}
              onChange={(e) => set("place", e.target.value)}
              required
              minLength={2}
              maxLength={100}
              placeholder="填写公园、书店等公共场所"
            />
          </label>
          <div className="np-form-grid">
            <label>
              提交截止时间
              <input
                type="datetime-local"
                value={form.deadline}
                onChange={(e) => set("deadline", e.target.value)}
                required
              />
              <small>按本机时区输入，发布后显示北京时间</small>
            </label>
            <label>
              参与名额
              <input
                type="number"
                min={1}
                max={100}
                value={form.capacity}
                onChange={(e) => set("capacity", Number(e.target.value))}
                required
              />
              <small>1–100 人，每人独立提交与验收</small>
            </label>
          </div>
          <div className="np-info">
            <Trophy size={20} />
            <div>
              <strong>验收通过，每人获得 20 XP</strong>
              <p>
                截止后不能提交新记录；已提交的记录仍可验收。成长值由系统统一设定。
              </p>
            </div>
          </div>
          {error && (
            <p className="np-error" role="alert">
              {error}
            </p>
          )}
          <footer className="np-dialog-actions">
            <button
              type="button"
              className="np-button secondary"
              disabled={busy}
              onClick={() => void save("draft")}
            >
              <Bookmark size={17} />
              保存草稿
            </button>
            <button className="np-button" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Send size={17} />
              )}
              发布任务
            </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
