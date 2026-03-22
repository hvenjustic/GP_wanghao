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
    return "账号或密码不正确，请使用下方演示账号登录。";
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
        <h1 className="app-header-title">开始接通登录和权限控制</h1>
        <p className="app-header-subtitle">
          当前阶段先采用演示账号 + Cookie 会话方式打通最小闭环，后续再替换为
          基于数据库的真实用户、角色和权限体系。不同角色登录后，能看到的导航和页面权限不同。
        </p>
      </section>

      <div className="auth-grid">
        <section className="auth-panel">
          <h2>账号登录</h2>
          <p className="muted">
            登录后即可访问项目总览和对应权限范围内的页面。未登录访问受保护页面会自动跳转到这里。
          </p>

          <form action="/api/auth/login" method="post" className="auth-form">
            <input type="hidden" name="redirectTo" value={redirectTo} />

            <label className="auth-field">
              <span className="field-label">邮箱</span>
              <input
                className="text-input"
                type="email"
                name="email"
                placeholder="请输入演示邮箱"
                defaultValue="ops@gp.local"
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
                defaultValue="Ops123!"
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
          <h2>演示账号</h2>
          <p className="muted">这些账号已经内置了不同的角色权限，可以直接用来验证导航和页面访问控制。</p>

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
