import { MetricCard } from "@/components/ui/metric-card";
import { SectionCard } from "@/components/ui/section-card";
import { permissionCodes } from "@/lib/auth/types";
import { requirePermission } from "@/lib/auth/guards";
import { getUserManagementOverview } from "@/server/services/user-service";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function UsersPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const currentUser = await requirePermission("users:view", "/users");
  const overview = await getUserManagementOverview();
  const params = await searchParams;
  const notice = getSingleValue(params.notice);
  const error = getSingleValue(params.error);

  return (
    <div className="page-grid">
      <header className="app-header">
        <div>
          <h1 className="app-header-title">用户与权限管理</h1>
          <p className="app-header-subtitle">
            当前页面用于管理数据库中的用户状态、角色归属和权限边界。高风险操作会直接写入审计日志。
          </p>
        </div>
        <div className="app-header-meta">
          {currentUser.name} · {currentUser.roleName}
        </div>
      </header>

      {notice ? <div className="alert-banner alert-banner-success">{notice}</div> : null}
      {error ? <div className="alert-banner alert-banner-error">{error}</div> : null}

      <div className="stats-grid">
        <MetricCard
          label="用户总数"
          value={`${overview.summary.totalUsers} 人`}
          hint="当前数据库中的可管理用户数量。"
        />
        <MetricCard
          label="启用账号"
          value={`${overview.summary.activeUsers} 人`}
          hint="状态为 ACTIVE 的用户，可正常登录系统。"
        />
        <MetricCard
          label="禁用账号"
          value={`${overview.summary.disabledUsers} 人`}
          hint="已被禁用的账号无法继续登录。"
        />
        <MetricCard
          label="角色数量"
          value={`${overview.summary.roleCount} 个`}
          hint="当前已经落库并启用的角色定义。"
        />
      </div>

      <SectionCard
        eyebrow="用户清单"
        title="账号状态与角色分配"
        description="当前先提供最小可用的账号启停和角色调整能力，避免继续依赖固定演示账号。"
      >
        <table className="data-table">
          <thead>
            <tr>
              <th>用户</th>
              <th>状态</th>
              <th>当前角色</th>
              <th>权限</th>
              <th>更新时间</th>
              <th>状态管理</th>
              <th>角色管理</th>
              <th>密码维护</th>
            </tr>
          </thead>
          <tbody>
            {overview.users.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="table-cell-stack">
                    <strong>{user.name}</strong>
                    <span className="muted">{user.email}</span>
                  </div>
                </td>
                <td>
                  <span
                    className={
                      user.status === "ACTIVE"
                        ? "status-pill status-pill-green"
                        : "status-pill status-pill-red"
                    }
                  >
                    {user.status === "ACTIVE" ? "启用" : "禁用"}
                  </span>
                </td>
                <td>{user.primaryRoleName}</td>
                <td>
                  <div className="chip-row">
                    {user.permissions.map((permission) => (
                      <span key={permission} className="chip">
                        {permission}
                      </span>
                    ))}
                  </div>
                </td>
                <td>{user.updatedAt}</td>
                <td>
                  <form className="table-form" action={`/api/users/${user.id}/actions`} method="post">
                    <input type="hidden" name="action" value="set-status" />
                    <select
                      className="select-input select-input-compact"
                      name="status"
                      defaultValue={user.status}
                    >
                      <option value="ACTIVE">启用</option>
                      <option value="DISABLED">禁用</option>
                    </select>
                    <button type="submit" className="button-secondary">
                      更新状态
                    </button>
                  </form>
                </td>
                <td>
                  <form className="table-form" action={`/api/users/${user.id}/actions`} method="post">
                    <input type="hidden" name="action" value="set-role" />
                    <select
                      className="select-input select-input-compact"
                      name="roleCode"
                      defaultValue={user.primaryRoleCode ?? ""}
                    >
                      {overview.roles.map((role) => (
                        <option key={role.id} value={role.code}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="button-secondary">
                      更新角色
                    </button>
                  </form>
                </td>
                <td>
                  <form className="table-form" action={`/api/users/${user.id}/actions`} method="post">
                    <input type="hidden" name="action" value="reset-password" />
                    <input
                      className="text-input"
                      name="newPassword"
                      type="password"
                      minLength={8}
                      placeholder="输入新密码"
                      required
                    />
                    <button type="submit" className="button-secondary">
                      重置密码
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      <SectionCard
        eyebrow="角色矩阵"
        title="角色与权限边界"
        description="当前角色仍保持单角色模型，权限编辑会直接影响对应角色下用户的会话刷新结果。"
      >
        <div className="three-col-grid">
          {overview.roles.map((role) => (
            <form
              key={role.id}
              className="surface-card role-card"
              action={`/api/roles/${role.code}/permissions`}
              method="post"
            >
              <div className="table-cell-stack">
                <strong>{role.name}</strong>
                <span className="muted">
                  {role.code} · {role.userCount} 人
                </span>
              </div>
              <span
                className={
                  role.status === "ACTIVE"
                    ? "status-pill status-pill-green"
                    : "status-pill status-pill-slate"
                }
              >
                {role.status}
              </span>
              <div className="checkbox-grid">
                {permissionCodes.map((permission) => (
                  <label key={permission} className="checkbox-card">
                    <input
                      type="checkbox"
                      name="permissionCodes"
                      value={permission}
                      defaultChecked={role.permissionCodes.includes(permission)}
                    />
                    <span>{permission}</span>
                  </label>
                ))}
              </div>
              <button type="submit" className="button-secondary">
                保存权限
              </button>
            </form>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
