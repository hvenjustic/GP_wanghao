import Link from "next/link";
import { navigationItems } from "@/lib/config/navigation";
import { requireAuth } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function ForbiddenPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const session = await requireAuth("/forbidden");
  const params = await searchParams;
  const requiredPermission = getSingleValue(params.required);
  const visibleNavigation = navigationItems.filter((item) =>
    hasPermission(session, item.permission)
  );

  return (
    <div className="page-grid">
      <header className="app-header">
        <div>
          <h1 className="app-header-title">当前账号没有访问权限</h1>
          <p className="app-header-subtitle">
            你已登录为 {session.roleName}，但这个页面需要额外权限才能访问。当前触发的权限码是
            {requiredPermission || "未指定"}。
          </p>
        </div>
        <div className="app-header-meta">{session.name}</div>
      </header>

      <section className="surface-card">
        <span className="eyebrow">可访问入口</span>
        <h2>返回你当前角色可访问的模块</h2>
        <ul className="bullet-list">
          {visibleNavigation.map((item) => (
            <li key={item.href}>
              <span className="bullet-title">
                <Link href={item.href}>{item.label}</Link>
              </span>
              <span className="muted">{item.description}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
