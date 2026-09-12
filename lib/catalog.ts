export type Quest = {
  id: string;
  title: string;
  short: string;
  description: string;
  category: string;
  kind: "explore" | "npc";
  xp: number;
  attribute: number;
  minutes: number;
  steps: string[];
  icon: string;
  area: string;
  point: [number, number];
};
export const attributes = [
  "好奇心",
  "社交力",
  "行动力",
  "探索欲",
  "自律",
  "生活半径",
];
export const roles = [
  "学生",
  "职场人",
  "自由职业",
  "创业者",
  "旅行爱好者",
  "其他",
];
export const cities: Record<string, [number, number]> = {
  上海: [121.4737, 31.2304],
  北京: [116.3974, 39.9092],
  杭州: [120.1536, 30.2875],
  深圳: [114.0579, 22.5431],
  成都: [104.0665, 30.5723],
  广州: [113.2644, 23.1291],
};
export const quests: Quest[] = [
  {
    id: "cafe",
    title: "推开一家陌生小店的门",
    short: "陌生小店",
    description: "走进一家从没去过的小店，点一杯新饮品，和店员聊一句日常。",
    category: "打破日常",
    kind: "explore",
    xp: 10,
    attribute: 0,
    minutes: 20,
    steps: [
      "找一家你从未去过的小店",
      "与店员进行至少一句交流",
      "记录店名与一个让你印象深刻的细节",
    ],
    icon: "Coffee",
    area: "你身边的街区",
    point: [121.458, 31.219],
  },
  {
    id: "walk",
    title: "换一条路，散一次步",
    short: "新路漫步",
    description:
      "把熟悉的路线留在身后。走进一条没走过的街，发现三个平时不会注意到的细节。",
    category: "城市探索",
    kind: "explore",
    xp: 15,
    attribute: 3,
    minutes: 25,
    steps: [
      "选择一条与日常不同的路线",
      "步行探索至少十分钟",
      "记下沿途三个新发现",
    ],
    icon: "Footprints",
    area: "一条新街道",
    point: [121.48, 31.237],
  },
  {
    id: "park",
    title: "在绿意里，留白十分钟",
    short: "公园留白",
    description: "找一处公园或绿地，收起屏幕，听一听周围的声音。",
    category: "找回专注",
    kind: "explore",
    xp: 10,
    attribute: 4,
    minutes: 15,
    steps: [
      "抵达一处公园或绿地",
      "放下手机，观察或静坐十分钟",
      "记录地点与当下的感受",
    ],
    icon: "Trees",
    area: "附近公园",
    point: [121.469, 31.226],
  },
  {
    id: "photo",
    title: "收集城市里的一抹颜色",
    short: "城市色彩",
    description: "选一种今天喜欢的颜色，在街头找到它，为这个平凡瞬间留下记录。",
    category: "发现灵感",
    kind: "explore",
    xp: 15,
    attribute: 0,
    minutes: 15,
    steps: [
      "选定一种颜色",
      "在现实街道找到对应的景物",
      "用照片或文字记录你发现的颜色和地点",
    ],
    icon: "Camera",
    area: "城市街角",
    point: [121.49, 31.232],
  },
  {
    id: "book",
    title: "向陌生人推荐一本书",
    short: "交换一本好书",
    description:
      "和同城玩家交换一本喜欢的书。不必善于社交，一段真诚的推荐就是很好的开始。",
    category: "遇见他人",
    kind: "npc",
    xp: 20,
    attribute: 1,
    minutes: 20,
    steps: [
      "发布邀请或加入一位同城玩家",
      "在公共场所交流一本喜欢的书，先征得对方同意",
      "各自记录交流体验，双方完成后解锁公开档案",
    ],
    icon: "BookOpen",
    area: "公共书店或图书馆",
    point: [121.46, 31.232],
  },
  {
    id: "hello",
    title: "交换一个城市私藏地点",
    short: "城市私藏",
    description:
      "和另一位城市探索者交换一处喜欢的公共地点，让彼此的地图多一个新坐标。",
    category: "遇见他人",
    kind: "npc",
    xp: 20,
    attribute: 1,
    minutes: 15,
    steps: [
      "加入或发起同城邀请",
      "在公共场所互相分享一个喜欢的地点",
      "写下你收获的新发现",
    ],
    icon: "Users",
    area: "双方约定的公共地点",
    point: [121.48, 31.221],
  },
];
export const questions = [
  {
    label: "最近一周，你主动尝试了多少新事物？",
    options: ["还没有", "1 件", "2–3 件", "4 件以上"],
  },
  {
    label: "与不熟悉的人交流，你的感受是？",
    options: ["比较紧张", "愿意简单打招呼", "能自然聊几句", "很享受认识新人"],
  },
  {
    label: "想到一件想做的事，你通常会？",
    options: ["先放一放", "需要一点推动", "安排时间去做", "马上迈出第一步"],
  },
  {
    label: "最近一周，你去过几个新地方？",
    options: ["0 个", "1 个", "2–3 个", "4 个以上"],
  },
  {
    label: "你能为自己留出多少专注时间？",
    options: ["很少", "偶尔十分钟", "每天十分钟", "每天半小时以上"],
  },
  {
    label: "你的日常活动范围大约是？",
    options: ["1 公里以内", "1–3 公里", "3–10 公里", "10 公里以上"],
  },
];
export function baseStats(answers: number[]) {
  return answers.map((x) => 2 + x * 2);
}
export function dayKey(time = Date.now()) {
  return new Date(time + 8 * 3600000).toISOString().slice(0, 10);
}
export function amapLink(city: string, keyword: string) {
  return `https://uri.amap.com/search?keyword=${encodeURIComponent(keyword)}&city=${encodeURIComponent(city)}&view=map&src=lifeNPC&callnative=0`;
}
