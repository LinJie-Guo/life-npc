export const categories = [
  "城市探索",
  "生活体验",
  "运动户外",
  "读书交流",
  "公益行动",
];
export const cities = ["上海", "北京", "杭州", "深圳", "成都", "广州"];
export const statusNames: Record<string, string> = {
  draft: "草稿",
  open: "招募中",
  closed: "已停止招募",
  finished: "已结束",
  cancelled: "已取消",
  joined: "进行中",
  submitted: "待验收",
  approved: "已完成",
  rejected: "待补充",
  withdrawn: "已退出",
  expired: "已逾期",
};
export const historyNames: Record<string, string> = {
  draft: "创建草稿",
  publish: "发布任务",
  edit: "修改草稿",
  join: "有人报名",
  withdraw: "退出任务",
  submit: "提交完成记录",
  approved: "验收通过",
  rejected: "退回补充",
  deadline: "任务截止",
  close: "停止招募",
  cancel: "取消任务",
};
export function date(n: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(n);
}
export function remaining(n: number) {
  const hours = (n - Date.now()) / 3600000;
  return hours <= 0
    ? "已截止"
    : hours < 1
      ? "即将截止"
      : hours < 24
        ? `剩余 ${Math.ceil(hours)} 小时`
        : `剩余 ${Math.ceil(hours / 24)} 天`;
}
export async function api<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch("/api/" + url, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const data = (await r.json()) as T & { error?: string };
  if (!r.ok)
    throw Object.assign(new Error(data.error || "请求失败"), {
      status: r.status,
    });
  return data;
}
