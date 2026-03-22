import Link from "next/link";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionCard } from "@/components/ui/section-card";
import { orderStateMap, orderStates } from "@/features/orders/config/order-states";
import { requirePermission } from "@/lib/auth/guards";
import {
  getOrderAvailableActions,
  getOrderList,
  normalizeOrderFilters
} from "@/server/services/order-service";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function formatAmount(amount: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2
  }).format(amount);
}

function getStatusClassName(statusCode: keyof typeof orderStateMap) {
  const state = orderStateMap[statusCode];
  return `status-pill status-pill-${state.tone}`;
}

function getSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function buildCurrentListUrl(searchParams: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "notice" || key === "error") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item) {
          query.append(key, item);
        }
      }
      continue;
    }

    if (value) {
      query.set(key, value);
    }
  }

  const queryString = query.toString();

  return queryString ? `/orders?${queryString}` : "/orders";
}

export default async function OrdersPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const currentUser = await requirePermission("orders:view", "/orders");
  const rawSearchParams = await searchParams;
  const filters = normalizeOrderFilters(rawSearchParams);
  const orderResult = await getOrderList(filters);
  const notice = getSingleValue(rawSearchParams.notice);
  const error = getSingleValue(rawSearchParams.error);
  const redirectTo = buildCurrentListUrl(rawSearchParams);
  const canBatchReview = currentUser.permissions.includes("orders:review");

  return (
    <div className="page-grid">
      <header className="app-header">
        <div>
          <h1 className="app-header-title">订单列表页</h1>
          <p className="app-header-subtitle">
            订单模块已经从展示骨架升级为带登录权限、筛选查询、角色动作和统计概览的真实列表页。
            当前角色为 {currentUser.roleName}，数据源为 {orderResult.dataSource}。
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
          label="当前结果"
          value={`${orderResult.summary.total} 条`}
          hint="按当前筛选条件返回的订单数量。"
        />
        <MetricCard
          label="审核队列"
          value={`${orderResult.summary.reviewCount} 条`}
          hint="待审核和人工审核状态的订单总数。"
        />
        <MetricCard
          label="待发货"
          value={`${orderResult.summary.shipmentCount} 条`}
          hint="当前还需要录入物流并执行发货的订单数量。"
        />
        <MetricCard
          label="异常订单"
          value={`${orderResult.summary.abnormalCount} 条`}
          hint="命中异常标记或需要重点处理的订单数量。"
        />
      </div>

      <SectionCard
        eyebrow="筛选条件"
        title="订单查询"
        description="当前先实现服务端查询表单，后续可继续增强为高级筛选、保存视图和批量处理。"
      >
        <form className="filter-grid" method="get">
          <label className="form-field">
            <span className="field-label">关键字</span>
            <input
              className="text-input"
              name="keyword"
              placeholder="订单号 / 客户名 / 手机号"
              defaultValue={filters.keyword}
            />
          </label>

          <label className="form-field">
            <span className="field-label">订单状态</span>
            <select className="select-input" name="status" defaultValue={filters.status}>
              <option value="">全部状态</option>
              {orderStates.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="field-label">来源渠道</span>
            <select
              className="select-input"
              name="sourceChannel"
              defaultValue={filters.sourceChannel}
            >
              <option value="">全部来源</option>
              {orderResult.sourceOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="field-label">仓库</span>
            <select
              className="select-input"
              name="warehouseName"
              defaultValue={filters.warehouseName}
            >
              <option value="">全部仓库</option>
              {orderResult.warehouseOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="checkbox-line">
            <input type="checkbox" name="abnormalOnly" value="true" defaultChecked={filters.abnormalOnly} />
            仅查看异常订单
          </label>

          <div className="form-actions">
            <button type="submit" className="button-primary">
              筛选
            </button>
            <Link href="/orders" className="button-secondary">
              重置
            </Link>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        eyebrow="查询结果"
        title="订单工作台"
        description={`当前共返回 ${orderResult.total} 条订单。行内动作会根据登录角色权限动态变化。`}
      >
        {canBatchReview ? (
          <form className="batch-panel" action="/api/orders/batch-actions" method="post">
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <div className="batch-panel-main">
              <label className="form-field">
                <span className="field-label">批量动作</span>
                <select className="select-input" name="action" defaultValue="approve-review">
                  <option value="approve-review">批量审核通过</option>
                  <option value="lock-order">批量锁单</option>
                  <option value="unlock-order">批量解锁</option>
                </select>
              </label>
              <label className="form-field batch-panel-note">
                <span className="field-label">操作原因</span>
                <input
                  className="text-input"
                  name="reason"
                  placeholder="锁单或解锁时必须填写，审核通过可选"
                />
              </label>
              <div className="form-actions">
                <button type="submit" className="button-primary">
                  执行批量动作
                </button>
              </div>
            </div>

            {orderResult.items.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>选择</th>
                    <th>订单信息</th>
                    <th>客户</th>
                    <th>状态</th>
                    <th>仓库</th>
                    <th>标签</th>
                    <th>金额</th>
                    <th>创建时间</th>
                    <th>可执行操作</th>
                  </tr>
                </thead>
                <tbody>
                  {orderResult.items.map((order) => {
                    const state = orderStateMap[order.status];
                    const actions = getOrderAvailableActions(order, currentUser.permissions);

                    return (
                      <tr key={order.id}>
                        <td>
                          <input
                            className="table-checkbox"
                            type="checkbox"
                            name="orderIds"
                            value={order.id}
                          />
                        </td>
                        <td>
                          <div className="table-cell-stack">
                            <strong>
                              <Link href={`/orders/${order.id}`} className="table-link">
                                {order.orderNo}
                              </Link>
                            </strong>
                            <span className="muted">{order.sourceChannel}</span>
                          </div>
                        </td>
                        <td>
                          <div className="table-cell-stack">
                            <strong>{order.customerName}</strong>
                            <span className="muted">{order.phone}</span>
                          </div>
                        </td>
                        <td>
                          <div className="table-cell-stack">
                            <span className={getStatusClassName(order.status)}>{state.name}</span>
                            {order.isAbnormal ? (
                              <span className="status-pill status-pill-red">异常</span>
                            ) : null}
                            {order.isLocked ? (
                              <span className="status-pill status-pill-slate">锁单</span>
                            ) : null}
                          </div>
                        </td>
                        <td>{order.warehouseName ?? <span className="muted">待分配</span>}</td>
                        <td>
                          <div className="chip-row">
                            {order.tags.map((tag) => (
                              <span key={tag} className="chip">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>{formatAmount(order.amount)}</td>
                        <td>{order.createdAt}</td>
                        <td>
                          <div className="chip-row">
                            {actions.map((action) => (
                              <span key={action} className="chip">
                                {action}
                              </span>
                            ))}
                            <Link href={`/orders/${order.id}`} className="chip">
                              打开详情
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <strong>没有匹配的订单</strong>
                <p className="muted">当前筛选条件没有命中结果，可以重置筛选后重试。</p>
                <Link href="/orders" className="button-secondary">
                  返回全部订单
                </Link>
              </div>
            )}
          </form>
        ) : orderResult.items.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>订单信息</th>
                <th>客户</th>
                <th>状态</th>
                <th>仓库</th>
                <th>标签</th>
                <th>金额</th>
                <th>创建时间</th>
                <th>可执行操作</th>
              </tr>
            </thead>
            <tbody>
              {orderResult.items.map((order) => {
                const state = orderStateMap[order.status];
                const actions = getOrderAvailableActions(order, currentUser.permissions);

                return (
                  <tr key={order.id}>
                    <td>
                      <div className="table-cell-stack">
                        <strong>
                          <Link href={`/orders/${order.id}`} className="table-link">
                            {order.orderNo}
                          </Link>
                        </strong>
                        <span className="muted">{order.sourceChannel}</span>
                      </div>
                    </td>
                    <td>
                      <div className="table-cell-stack">
                        <strong>{order.customerName}</strong>
                        <span className="muted">{order.phone}</span>
                      </div>
                    </td>
                    <td>
                      <div className="table-cell-stack">
                        <span className={getStatusClassName(order.status)}>{state.name}</span>
                        {order.isAbnormal ? (
                          <span className="status-pill status-pill-red">异常</span>
                        ) : null}
                        {order.isLocked ? (
                          <span className="status-pill status-pill-slate">锁单</span>
                        ) : null}
                      </div>
                    </td>
                    <td>{order.warehouseName ?? <span className="muted">待分配</span>}</td>
                    <td>
                      <div className="chip-row">
                        {order.tags.map((tag) => (
                          <span key={tag} className="chip">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{formatAmount(order.amount)}</td>
                    <td>{order.createdAt}</td>
                    <td>
                      <div className="chip-row">
                        {actions.map((action) => (
                          <span key={action} className="chip">
                            {action}
                          </span>
                        ))}
                        <Link href={`/orders/${order.id}`} className="chip">
                          打开详情
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <strong>没有匹配的订单</strong>
            <p className="muted">当前筛选条件没有命中结果，可以重置筛选后重试。</p>
            <Link href="/orders" className="button-secondary">
              返回全部订单
            </Link>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
