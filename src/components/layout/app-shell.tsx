"use client";

import type { PropsWithChildren } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hasPermission, type AuthSession } from "@/lib/auth/types";
import { navigationItems } from "@/lib/config/navigation";

type AppShellProps = PropsWithChildren<{
  currentUser: AuthSession | null;
}>;

export function AppShell({ children, currentUser }: AppShellProps) {
  const pathname = usePathname();
  const isLoginPage = pathname.startsWith("/login");

  if (isLoginPage) {
    return <main className="auth-page-shell">{children}</main>;
  }

  const visibleNavigationItems = navigationItems.filter((item) =>
    hasPermission(currentUser, item.permission)
  );

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">
          <span className="app-brand-badge">GP</span>
          <div className="app-brand-title">低代码订单管理系统</div>
          <p className="app-brand-desc">
            基于 Next.js、PostgreSQL、Prisma 和规则编排能力的单仓项目骨架。
          </p>
        </div>

        <nav className="app-nav" aria-label="主导航">
          {visibleNavigationItems.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`app-nav-item${isActive ? " app-nav-item-active" : ""}`}
              >
                <span className="app-nav-title">{item.label}</span>
                <span className="app-nav-desc">{item.description}</span>
              </Link>
            );
          })}
        </nav>

        <div className="app-sidebar-footer">
          {currentUser ? (
            <div className="sidebar-user-card">
              <div className="sidebar-user-name">{currentUser.name}</div>
              <div className="sidebar-user-meta">
                {currentUser.roleName} · {currentUser.email}
              </div>
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="button-secondary button-block">
                  退出登录
                </button>
              </form>
            </div>
          ) : (
            <Link href="/login" className="button-secondary button-block">
              前往登录
            </Link>
          )}
        </div>
      </aside>

      <main className="app-main">{children}</main>
    </div>
  );
}
