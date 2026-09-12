/* Native links also support the standalone SPA runtime. */
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */
"use client";
import { useState } from "react";
import {
  Compass,
  MapPin,
  ArrowUpRight,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Toaster, toast } from "sonner";
import { cities, api } from "@/lib/community-client";
function Recovery({ code, onDone }: { code: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="np-recovery">
      <ShieldCheck size={36} />
      <h2>保存你的账号恢复码</h2>
      <p>
        忘记密码时，用账号和恢复码重设密码。恢复码仅显示这一次，请保存到安全的地方。
      </p>
      <code>{code}</code>
      <button
        className="np-button secondary"
        onClick={() => {
          const blob = new Blob(
            ["人生 NPC 账号恢复码\n" + code + "\n请勿分享给他人。"],
            { type: "text/plain" },
          );
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "人生NPC-账号恢复码.txt";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          setSaved(true);
        }}
      >
        下载恢复码
      </button>
      <label className="np-check">
        <Checkbox
          checked={saved}
          onCheckedChange={(v) => setSaved(v === true)}
        />
        我已妥善保存恢复码
      </label>
      <button className="np-button" disabled={!saved} onClick={onDone}>
        继续 <ArrowUpRight size={18} />
      </button>
    </div>
  );
}
export default function Auth({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState("login"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [recovery, setRecovery] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await api<{ recoveryCode?: string }>(
        "auth/" + mode,
        values,
      );
      if (result.recoveryCode) setRecovery(result.recoveryCode);
      else onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="np-auth">
      <div className="np-auth-story">
        <a href="/" className="np-brand">
          <Compass />
          人生 NPC<span>走进真实生活</span>
        </a>
        <div className="np-story-copy">
          <span className="np-kicker">YOUR NEXT CHAPTER</span>
          <h1>
            下一段故事，
            <br />
            从走出去开始。
          </h1>
          <p>
            发现一件想做的小事。
            <br />
            也成为，让故事发生的那个人。
          </p>
          <div className="np-story-label">
            <MapPin size={16} /> 一条新路 · 一次相遇 · 一个新的自己
          </div>
        </div>
        <img src="/images/cafe.png" alt="夜色中温暖的街角咖啡店" />
      </div>
      <section className="np-auth-panel">
        {recovery ? (
          <Recovery
            code={recovery}
            onDone={() => {
              setRecovery("");
              if (mode === "recover") {
                setMode("login");
                toast.success("密码已重设，请登录");
              } else onSuccess();
            }}
          />
        ) : (
          <div className="np-auth-form">
            <span className="np-kicker">LIFE NPC</span>
            <h2>
              {mode === "register"
                ? "创建你的探索账号"
                : mode === "recover"
                  ? "找回你的账号"
                  : "欢迎回来，探索者"}
            </h2>
            <p>
              {mode === "register"
                ? "每个人都能参与任务，也能发起一次相遇。"
                : mode === "recover"
                  ? "输入注册时保存的恢复码，设置新密码。"
                  : "登录后，接着完成你的下一件小事。"}
            </p>
            {mode !== "recover" && (
              <Tabs
                value={mode}
                onValueChange={(v) => {
                  setMode(v);
                  setError("");
                }}
              >
                <TabsList className="np-auth-tabs">
                  <TabsTrigger value="login">登录</TabsTrigger>
                  <TabsTrigger value="register">注册账号</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <form onSubmit={submit} key={mode}>
              <label>
                账号
                <input
                  name="username"
                  required
                  minLength={4}
                  maxLength={32}
                  pattern="[a-zA-Z0-9_]+"
                  autoComplete="username"
                  placeholder="4–32 位字母、数字或下划线"
                />
              </label>
              {mode === "register" && (
                <div className="np-form-grid">
                  <label>
                    昵称
                    <input
                      name="name"
                      maxLength={24}
                      required
                      placeholder="大家怎么称呼你"
                      autoComplete="nickname"
                    />
                  </label>
                  <label>
                    所在城市
                    <NativeSelect name="city" defaultValue="上海">
                      {cities.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </NativeSelect>
                  </label>
                </div>
              )}
              {mode === "recover" && (
                <label>
                  账号恢复码
                  <input
                    name="recoveryCode"
                    required
                    maxLength={48}
                    autoComplete="off"
                    placeholder="48 位恢复码"
                  />
                </label>
              )}
              <label>
                {mode === "recover" ? "新密码" : "密码"}
                <input
                  name="password"
                  type="password"
                  required
                  minLength={mode === "login" ? 1 : 10}
                  maxLength={128}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  placeholder={
                    mode === "login"
                      ? "输入密码"
                      : "至少 10 位，建议混合字母与数字"
                  }
                />
              </label>
              {error && (
                <p className="np-error" role="alert">
                  {error}
                </p>
              )}
              <button className="np-button full" disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={18} /> : null}
                {mode === "register"
                  ? "注册并开启旅程"
                  : mode === "recover"
                    ? "重设密码"
                    : "登录"}
                <ArrowUpRight size={18} />
              </button>
            </form>
            <button
              className="np-link"
              onClick={() => {
                setMode(mode === "recover" ? "login" : "recover");
                setError("");
              }}
            >
              {mode === "recover" ? "返回登录" : "忘记密码？使用恢复码找回"}
            </button>
            <div className="np-auth-note">
              <ShieldCheck size={17} /> 密码加密存储 · 私人记录仅对授权用户可见
            </div>
          </div>
        )}
      </section>
      <Toaster richColors position="top-center" />
    </main>
  );
}
