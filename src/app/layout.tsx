import type { Metadata } from "next";
import { AppProviders } from "@/components/layout/app-providers";
import { AppShell } from "@/components/layout/app-shell";
import { getAuthSession } from "@/lib/auth/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "面向中小电商的低代码订单管理系统",
  description: "订单后台、低代码配置与规则编排的一体化项目骨架"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUser = await getAuthSession();

  return (
    <html lang="zh-CN">
      <body>
        <AppProviders>
          <AppShell currentUser={currentUser}>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
