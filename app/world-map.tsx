"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin, ExternalLink, Navigation } from "lucide-react";
import { quests, cities, amapLink, type Quest } from "@/lib/catalog";
// The JS API is loaded only when a configured map is displayed.
type MapHandle = {
  destroy: () => void;
  add: (markers: unknown[]) => void;
  setFitView: () => void;
};
type AMapAPI = {
  Map: new (el: HTMLElement, options: unknown) => MapHandle;
  Marker: new (options: unknown) => {
    on: (event: string, handler: () => void) => void;
  };
};
declare global {
  interface Window {
    AMap?: AMapAPI;
    _AMapSecurityConfig?: { serviceHost: string };
  }
}
let loader: Promise<AMapAPI> | null = null;
function loadMap(key: string) {
  if (window.AMap) return Promise.resolve(window.AMap);
  if (loader) return loader;
  window._AMapSecurityConfig = {
    serviceHost: location.origin + "/_AMapService",
  };
  loader = new Promise<AMapAPI>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}`;
    const fail = () => {
      clearTimeout(timeout);
      s.remove();
      loader = null;
      reject(new Error("地图暂未加载，请检查网络后重试"));
    };
    const timeout = setTimeout(fail, 12000);
    s.onload = () => {
      clearTimeout(timeout);
      if (window.AMap) resolve(window.AMap);
      else fail();
    };
    s.onerror = fail;
    document.head.appendChild(s);
  });
  return loader;
}
export default function WorldMap({
  city,
  onSelect,
  filter,
}: {
  city: string;
  onSelect: (q: Quest) => void;
  filter: string;
}) {
  const ref = useRef<HTMLDivElement>(null),
    select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);
  const [status, setStatus] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true,
      map: MapHandle | undefined;
    fetch("/api/map-config")
      .then((r) => r.json() as Promise<{ key: string; enabled: boolean }>)
      .then(async (c) => {
        if (!c.enabled) {
          if (alive) setStatus("unconfigured");
          return;
        }
        const A = await loadMap(c.key);
        if (!alive || !ref.current) return;
        map = new A.Map(ref.current, {
          zoom: 13,
          center: cities[city],
          mapStyle: "amap://styles/darkblue",
        });
        const list = quests.filter(
          (q) => filter === "all" || q.kind === filter,
        );
        map.add(
          list.map((q) => {
            const offset = [q.point[0] - 121.4737, q.point[1] - 31.2304];
            const marker = new A.Marker({
              position: [
                cities[city][0] + offset[0],
                cities[city][1] + offset[1],
              ],
              title: q.title,
              label: { content: q.short, direction: "top" },
            });
            marker.on("click", () => select.current(q));
            return marker;
          }),
        );
        map.setFitView();
        setStatus("ready");
      })
      .catch(() => {
        if (alive) setStatus("error");
      });
    return () => {
      alive = false;
      map?.destroy();
    };
  }, [city, filter, attempt]);
  return (
    <div className="map-container">
      <div className="amap-canvas" ref={ref} />
      {status !== "ready" && (
        <div className="map-fallback">
          <div className="map-compass">
            <Navigation size={44} />
          </div>
          <span className="eyebrow">{city.toUpperCase()} · EXPLORATION</span>
          <h2>
            {status === "loading"
              ? "正在展开你的地图…"
              : "下一站，走进真实的城市"}
          </h2>
          <p>
            {status === "unconfigured"
              ? "内嵌地图等待高德服务配置。你可以直接打开高德，寻找身边的探索地点。"
              : status === "error"
                ? "地图暂时无法加载，仍可使用下方探索清单。"
                : "正在连接高德地图"}
          </p>
          {status !== "loading" && (
            <a
              className="primary"
              href={amapLink(city, "公园 咖啡馆 书店")}
              target="_blank"
              rel="noreferrer"
            >
              在高德中探索 <ExternalLink size={17} />
            </a>
          )}
          {status === "error" && (
            <button
              className="text-button"
              onClick={() => {
                setStatus("loading");
                setAttempt(attempt + 1);
              }}
            >
              重新加载
            </button>
          )}
        </div>
      )}
      <span className="map-caption">
        <MapPin size={14} />
        {status === "ready"
          ? "标记为探索建议区域，非店铺或玩家实时位置"
          : "地点由你选择 · 定位仅在主动记录时使用"}
      </span>
    </div>
  );
}
