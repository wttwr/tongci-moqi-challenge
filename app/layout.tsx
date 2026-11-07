import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "同词相遇 · 多人默契挑战",
  description: "邀请 2–5 位朋友远程同时写下答案，看看大家能否同词相遇。",
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
