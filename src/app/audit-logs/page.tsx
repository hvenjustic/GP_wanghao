import Link from "next/link";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionCard } from "@/components/ui/section-card";
import { requirePermission } from "@/lib/auth/guards";
import {
  getAuditLogOverview,
  normalizeAuditLogFilters
} from "@/server/services/log-service";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AuditLogsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const currentUser = await requirePermission("users:view", "/audit-logs");
  const rawSearchParams = await searchParams;
  const filters = normalizeAuditLogFilters(rawSearchParams);
  const overview = await getAuditLogOverview(filters);

  return (
    <div className="page-grid">
      <header className="app-header">
        <div>
          <h1 className="app-header-title">审计日志查询</h1>
          <p className="app-header-subtitle">
            这里集中查看登录、用户治理和订单关键动作的系统审计记录。当前先提供服务端筛选版，便于追查谁在什么时间改了什么对象。
          </p>
        </div>
        <div className="app-header-meta">
          {currentUser.name} · {currentUser.roleName}
        </div>
      </header>

      <div className="stats-grid">
        <MetricCard
          label="当前结果"
          value={`${overview.summary.totalLogs} 条`}
          hint="按当前筛选条件返回的审计日志数量。"
        />
        <MetricCard
          label="认证行为"
          value={`${overview.summary.authCount} 条`}
          hint="登录和退出等认证链路动作。"
        />
        <MetricCard
          label="订单动作"
          value={`${overview.summary.orderCount} 条`}
          hint="订单状态流转、批量动作等业务写操作。"
        />
        <MetricCard
          label="权限治理"
          value={`${overview.summary.accessCount} 条`}
          hint="用户状态、角色权限和密码维护相关操作。"
        />
      </div>

      <SectionCard
        eyebrow="筛选条件"
        title="审计日志过滤器"
        description="支持按关键字、动作、目标类型和时间范围筛选。当前关键字会匹配操作者、动作编码和目标对象。"
      >
        <form className="filter-grid" method="get">
          <label className="form-field">
            <span className="field-label">关键字</span>
            <input
              className="text-input"
              name="keyword"
              placeholder="动作 / 操作者 / 目标 ID"
              defaultValue={filters.keyword}
            />
          </label>

          <label className="form-field">
            <span className="field-label">动作编码</span>
            <select className="select-input" name="action" defaultValue={filters.action}>
              <option value="">全部动作</option>
              {overview.actionOptions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="field-label">目标类型</span>
            <select
              className="select-input"
              name="targetType"
              defaultValue={filters.targetType}
            >
              <option value="">全部目标</option>
              {overview.targetTypeOptions.map((targetType) => (
                <option key={targetType} value={targetType}>
                  {targetType}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="field-label">开始日期</span>
            <input
              className="text-input"
              name="startDate"
              type="date"
              defaultValue={filters.startDate}
            />
          </label>

          <label className="form-field">
            <span className="field-label">结束日期</span>
            <input
              className="text-input"
              name="endDate"
              type="date"
              defaultValue={filters.endDate}
            />
          </label>

          <div className="form-actions">
            <button type="submit" className="button-primary">
              查询
            </button>
            <Link href="/audit-logs" className="button-secondary">
              重置
            </Link>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        eyebrow="查询结果"
        title="审计事件明细"
        description={`当前共返回 ${overview.items.length} 条记录。建议先按时间范围和动作缩小范围，再查看具体明细字段。`}
      >
        {overview.items.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>操作者</th>
                <th>动作</th>
                <th>目标</th>
                <th>明细</th>
              </tr>
            </thead>
            <tbody>
              {overview.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.createdAt}</td>
                  <td>
                    <div className="table-cell-stack">
                      <strong>{item.operatorName}</strong>
                      <span className="muted">{item.operatorEmail}</span>
                    </div>
                  </td>
                  <td>
                    <div className="table-cell-stack">
                      <span className="status-pill status-pill-blue">{item.action}</span>
                    </div>
                  </td>
                  <td>
                    <div className="table-cell-stack">
                      <span className="status-pill status-pill-slate">{item.targetType}</span>
                      <span className="muted">{item.targetId}</span>
                    </div>
                  </td>
                  <td>
                    <div className="table-cell-stack">
                      {item.detailEntries.length > 0 ? (
                        item.detailEntries.map((detail) => (
                          <span key={`${item.id}-${detail}`} className="muted">
                            {detail}
                          </span>
                        ))
                      ) : (
                        <span className="muted">无附加明细</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <strong>当前筛选条件下没有审计日志。</strong>
            <span className="muted">可以清空动作和日期条件后重新查询。</span>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
