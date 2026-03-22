import Link from "next/link";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionCard } from "@/components/ui/section-card";
import { requirePermission } from "@/lib/auth/guards";
import {
  getRuleLogOverview,
  normalizeRuleLogFilters
} from "@/server/services/log-service";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getStatusClassName(status: string) {
  switch (status) {
    case "SUCCESS":
      return "status-pill status-pill-green";
    case "BLOCKED":
    case "FAILED":
      return "status-pill status-pill-red";
    case "SKIPPED":
      return "status-pill status-pill-amber";
    default:
      return "status-pill status-pill-slate";
  }
}

export default async function RuleLogsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const currentUser = await requirePermission("rules:view", "/rule-logs");
  const rawSearchParams = await searchParams;
  const filters = normalizeRuleLogFilters(rawSearchParams);
  const overview = await getRuleLogOverview(filters);

  return (
    <div className="page-grid">
      <header className="app-header">
        <div>
          <h1 className="app-header-title">规则执行日志</h1>
          <p className="app-header-subtitle">
            当前页面用于追查规则版本在真实订单上的命中结果、输入输出和执行耗时。第一版先聚焦订单审核与分仓场景的执行记录。
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
          hint="按当前筛选条件返回的规则执行记录。"
        />
        <MetricCard
          label="成功执行"
          value={`${overview.summary.successCount} 条`}
          hint="状态为 SUCCESS 的规则执行次数。"
        />
        <MetricCard
          label="阻断或失败"
          value={`${overview.summary.blockedCount} 条`}
          hint="被规则阻断或执行失败的记录，用于排查异常链路。"
        />
        <MetricCard
          label="平均耗时"
          value={
            overview.summary.averageDurationMs > 0
              ? `${overview.summary.averageDurationMs} ms`
              : "-"
          }
          hint="当前结果集的平均执行耗时。"
        />
      </div>

      <SectionCard
        eyebrow="筛选条件"
        title="规则日志过滤器"
        description="支持按规则编码、触发场景、执行状态、订单关键字和日期范围查询。订单关键字会匹配订单号与来源单号。"
      >
        <form className="filter-grid" method="get">
          <label className="form-field">
            <span className="field-label">规则编码</span>
            <select className="select-input" name="ruleCode" defaultValue={filters.ruleCode}>
              <option value="">全部规则</option>
              {overview.ruleOptions.map((rule) => (
                <option key={rule.ruleCode} value={rule.ruleCode}>
                  {rule.ruleCode} · {rule.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="field-label">触发场景</span>
            <select className="select-input" name="scene" defaultValue={filters.scene}>
              <option value="">全部场景</option>
              {overview.sceneOptions.map((scene) => (
                <option key={scene} value={scene}>
                  {scene}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="field-label">执行状态</span>
            <select className="select-input" name="status" defaultValue={filters.status}>
              <option value="">全部状态</option>
              {overview.statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="field-label">订单关键字</span>
            <input
              className="text-input"
              name="orderKeyword"
              placeholder="订单号 / 来源单号"
              defaultValue={filters.orderKeyword}
            />
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
            <Link href="/rule-logs" className="button-secondary">
              重置
            </Link>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        eyebrow="执行明细"
        title="规则命中结果"
        description={`当前共返回 ${overview.items.length} 条规则执行日志，可直接核对规则版本、命中结果和关联订单。`}
      >
        {overview.items.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>规则</th>
                <th>场景 / 状态</th>
                <th>订单</th>
                <th>耗时</th>
                <th>输入摘要</th>
                <th>输出摘要</th>
              </tr>
            </thead>
            <tbody>
              {overview.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.createdAt}</td>
                  <td>
                    <div className="table-cell-stack">
                      <strong>{item.ruleName}</strong>
                      <span className="muted">
                        {item.ruleCode} · {item.ruleVersion}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="table-cell-stack">
                      <span className="status-pill status-pill-blue">{item.scene}</span>
                      <span className={getStatusClassName(item.status)}>{item.status}</span>
                    </div>
                  </td>
                  <td>
                    <div className="table-cell-stack">
                      <strong>{item.orderNo}</strong>
                      <span className="muted">
                        {item.sourceChannel} · {item.orderId}
                      </span>
                    </div>
                  </td>
                  <td>{typeof item.durationMs === "number" ? `${item.durationMs} ms` : "-"}</td>
                  <td>
                    <div className="table-cell-stack">
                      {item.inputEntries.length > 0 ? (
                        item.inputEntries.map((entry) => (
                          <span key={`${item.id}-input-${entry}`} className="muted">
                            {entry}
                          </span>
                        ))
                      ) : (
                        <span className="muted">无输入摘要</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="table-cell-stack">
                      {item.resultEntries.length > 0 ? (
                        item.resultEntries.map((entry) => (
                          <span key={`${item.id}-result-${entry}`} className="muted">
                            {entry}
                          </span>
                        ))
                      ) : (
                        <span className="muted">无输出摘要</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <strong>当前筛选条件下没有规则执行日志。</strong>
            <span className="muted">可以先清空条件，确认是否已有规则执行记录。</span>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
