import { createRoot } from "react-dom/client";
import { lazy, Suspense } from "react";
import Home from "./app/page";
import "./app/globals.css";
const Explore = lazy(() => import("./app/explore/page"));
createRoot(document.getElementById("root")!).render(
  location.pathname.startsWith("/explore") ? (
    <Suspense fallback={<p>正在加载探索空间…</p>}>
      <a className="explore-return" href="/">
        ← 返回任务广场
      </a>
      <Explore />
    </Suspense>
  ) : (
    <Home />
  ),
);
