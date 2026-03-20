"use client";

import type { PropsWithChildren } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationItems } from "@/lib/config/navigation";

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">
          <span className="app-brand-badge">GP</span>
          <div className="app-brand-title">低代码订单管理系统</div>
          <p className="app-brand-desc">
            基于 Next.js、Prisma、Supabase 和规则编排能力的单仓项目骨架。
          </p>
        </div>

        <nav className="app-nav" aria-label="主导航">
          {navigationItems.map((item) => {
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
      </aside>

      <main className="app-main">{children}</main>
    </div>
  );
}
