import { redirect } from "next/navigation";
import { getDemoUsersForDisplay } from "@/lib/auth/mock-users";
import { getAuthSession } from "@/lib/auth/session";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getLoginErrorMessage(errorCode: string) {
  if (errorCode === "invalid_credentials") {
    return "账号或密码不正确，请检查输入或使用下方账号登录。";
  }

  if (errorCode === "inactive_user") {
    return "当前账号已被禁用，请联系管理员处理。";
  }

  if (errorCode === "access_denied") {
    return "当前账号未分配有效角色或权限，暂时无法登录。";
  }

  return "";
}

export default async function LoginPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const session = await getAuthSession();

  if (session) {
    redirect("/");
  }

  const params = await searchParams;
  const redirectTo = getSingleValue(params.redirect) || "/";
  const errorMessage = getLoginErrorMessage(getSingleValue(params.error));
  const demoUsers = getDemoUsersForDisplay();

  return (
    <div className="auth-page">
      <section className="auth-panel auth-panel-highlight">
        <span className="eyebrow">登录权限</span>
        <h1 className="app-header-title">账号登录</h1>
        <p className="app-header-subtitle">
          系统根据数据库中的用户、角色和权限关系控制导航、页面访问和订单操作范围。
        </p>
      </section>

      <div className="auth-grid">
        <section className="auth-panel">
          <h2>账号登录</h2>
          <p className="muted">
            登录后可访问对应权限范围内的页面。未登录访问受保护页面时会自动跳转到这里。
          </p>

          <form action="/api/auth/login" method="post" className="auth-form">
            <input type="hidden" name="redirectTo" value={redirectTo} />

            <label className="auth-field">
              <span className="field-label">邮箱</span>
              <input
                className="text-input"
                type="email"
                name="email"
                placeholder="请输入账号邮箱"
                defaultValue="admin@gp.local"
                required
              />
            </label>

            <label className="auth-field">
              <span className="field-label">密码</span>
              <input
                className="text-input"
                type="password"
                name="password"
                placeholder="请输入密码"
                defaultValue="Admin123!"
                required
              />
            </label>

            {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}

            <button type="submit" className="button-primary button-block">
              登录系统
            </button>
          </form>
        </section>

        <section className="auth-panel">
          <h2>示例账号</h2>
          <p className="muted">这些账号已写入数据库，可用于登录不同角色并查看对应权限范围。</p>

          <ul className="demo-account-list">
            {demoUsers.map((user) => (
              <li key={user.userId}>
                <span className="bullet-title">
                  {user.roleName} · {user.name}
                </span>
                <span className="muted">
                  {user.email} / {user.passwordHint}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
