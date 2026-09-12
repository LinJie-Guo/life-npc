import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "人生 NPC · 现实探索",
  description: "走出日常，完成现实任务，遇见新的自己。",
  manifest: "/manifest.webmanifest",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
