import Link from "next/link";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionCard } from "@/components/ui/section-card";
import { orderStateMap, orderStates } from "@/features/orders/config/order-states";
import { requirePermission } from "@/lib/auth/guards";
import { consumeOrderBatchFeedback } from "@/server/services/order-batch-feedback-store";
import { consumeOrderImportFeedback } from "@/server/services/order-import-feedback-store";
import { getOrderExtensionListRuntime } from "@/server/services/meta-runtime-service";
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
  return buildOrderListUrl("/orders", searchParams);
}

function buildOrderExportUrl(searchParams: Record<string, string | string[] | undefined>) {
  return buildOrderListUrl("/api/orders/export", searchParams);
}

function buildOrderImportTemplateUrl() {
  return "/api/orders/import/template";
}

function buildOrderListUrl(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>
) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (
      key === "notice" ||
      key === "error" ||
      key === "batchFeedbackId" ||
      key === "importFeedbackId"
    ) {
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

  return queryString ? `${basePath}?${queryString}` : basePath;
}

function getBatchActionLabel(action: string) {
  switch (action) {
    case "approve-review":
      return "批量审核通过";
    case "lock-order":
      return "批量锁单";
    case "unlock-order":
      return "批量解锁";
    case "ship-order":
      return "批量发货";
    default:
      return "批量处理";
  }
}

function getAbnormalSummary(order: Awaited<ReturnType<typeof getOrderList>>["items"][number]) {
  if (order.isAbnormal) {
    return {
      title: order.abnormalContext?.currentReason || "异常处理中",
      detail: order.abnormalContext?.nextStep || "请先核实异常原因后继续处理。"
    };
  }

  if (order.abnormalContext?.latestResolvedAt) {
    return {
      title: "最近已恢复",
      detail:
        `${order.abnormalContext.latestResolvedAt} · ` +
        (order.abnormalContext.latestResolvedReason || "已解除异常")
    };
  }

  return {
    title: "无异常阻断",
    detail: "当前没有异常链路阻断。"
  };
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
  const batchFeedbackId = getSingleValue(rawSearchParams.batchFeedbackId);
  const batchFeedback = batchFeedbackId
    ? consumeOrderBatchFeedback(batchFeedbackId)
    : null;
  const importFeedbackId = getSingleValue(rawSearchParams.importFeedbackId);
  const importFeedback = importFeedbackId
    ? consumeOrderImportFeedback(importFeedbackId)
    : null;
  const extensionListRuntime = await getOrderExtensionListRuntime(orderResult.items);
  const extensionColumns = extensionListRuntime.ok ? extensionListRuntime.columns : [];
  const redirectTo = buildCurrentListUrl(rawSearchParams);
  const exportUrl = buildOrderExportUrl(rawSearchParams);
  const importTemplateUrl = buildOrderImportTemplateUrl();
  const canBatchManage =
    currentUser.permissions.includes("orders:review") ||
    currentUser.permissions.includes("orders:ship");
  const canImport = currentUser.permissions.includes("orders:review");
  const activeAbnormalOrders = orderResult.items.filter((item) => item.isAbnormal);
  const recentlyResolvedOrders = orderResult.items
    .filter((item) => !item.isAbnormal && item.abnormalContext?.latestResolvedAt)
    .sort((left, right) =>
      (right.abnormalContext?.latestResolvedAt ?? "").localeCompare(
        left.abnormalContext?.latestResolvedAt ?? ""
      )
    )
    .slice(0, 5);

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
        extra={
          <Link href={exportUrl} className="button-secondary">
            导出当前结果
          </Link>
        }
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

      {canImport ? (
        <SectionCard
          eyebrow="导入准备"
          title="订单导入模板与基础校验"
          description="当前先提供模板下载、上传入口和服务端基础校验。此阶段不会直接写入数据库，主要用于校验导入内容是否符合系统要求。"
          extra={
            <Link href={importTemplateUrl} className="button-secondary">
              下载导入模板
            </Link>
          }
        >
          {importFeedback ? (
            <div className="batch-feedback-card">
              <div className="batch-feedback-summary">
                <div className="table-cell-stack">
                  <strong>导入校验结果</strong>
                  <span className="muted">
                    生成时间：{importFeedback.createdAt}，共 {importFeedback.summary.totalRows} 行，
                    通过 {importFeedback.summary.validRows} 行，失败{" "}
                    {importFeedback.summary.invalidRows} 行。
                  </span>
                </div>
                <span
                  className={
                    importFeedback.summary.invalidRows > 0
                      ? "status-pill status-pill-amber"
                      : "status-pill status-pill-green"
                  }
                >
                  {importFeedback.summary.invalidRows > 0 ? "需修正" : "校验通过"}
                </span>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>行号</th>
                    <th>订单</th>
                    <th>结果</th>
                    <th>说明</th>
                  </tr>
                </thead>
                <tbody>
                  {importFeedback.items.map((item) => (
                    <tr key={`import-${item.rowNumber}-${item.orderNo}`}>
                      <td>{item.rowNumber}</td>
                      <td>{item.orderNo}</td>
                      <td>
                        <span
                          className={
                            item.ok
                              ? "status-pill status-pill-green"
                              : "status-pill status-pill-red"
                          }
                        >
                          {item.ok ? "通过" : "失败"}
                        </span>
                      </td>
                      <td>{item.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <form
            className="import-panel"
            action="/api/orders/import"
            method="post"
            encType="multipart/form-data"
          >
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <div className="import-panel-main">
              <label className="form-field">
                <span className="field-label">CSV 文件</span>
                <input
                  className="file-input"
                  type="file"
                  name="importFile"
                  accept=".csv,text/csv"
                  required
                />
              </label>
              <div className="table-cell-stack">
                <strong>模板要求</strong>
                <span className="muted">请先下载模板，保持表头不变。</span>
                <span className="muted">单次最多校验 200 行，文件大小不超过 1MB。</span>
              </div>
              <div className="form-actions">
                <button type="submit" className="button-primary">
                  上传并校验
                </button>
              </div>
            </div>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard
        eyebrow="异常工作台"
        title="异常处理联动视图"
        description={
          filters.abnormalOnly
            ? "当前已切换到异常订单视图。这里集中展示当前结果中的异常单、阻塞项和恢复建议。"
            : "这里汇总当前结果中的异常单与最近恢复记录，帮助运营快速判断需要优先处理的异常链路。"
        }
      >
        <div className="two-col-grid">
          <div className="version-card">
            <div className="table-cell-stack">
              <strong>当前异常订单</strong>
              <span className="muted">
                当前结果中共有 {activeAbnormalOrders.length} 条异常订单。
              </span>
            </div>
            {activeAbnormalOrders.length > 0 ? (
              <ul className="timeline-list">
                {activeAbnormalOrders.map((order) => (
                  <li key={`abnormal-${order.id}`}>
                    <span className="timeline-title">
                      <Link href={`/orders/${order.id}`} className="table-link">
                        {order.orderNo}
                      </Link>
                      {" · "}
                      {order.customerName}
                    </span>
                    <span>{order.abnormalContext?.currentReason || "异常处理中"}</span>
                    <br />
                    <span className="muted">
                      {order.abnormalContext?.nextStep || "请先核实异常原因并处理。"}
                    </span>
                    {order.abnormalContext?.blockers?.length ? (
                      <>
                        <br />
                        <span className="muted">
                          阻塞项：{order.abnormalContext.blockers.join("；")}
                        </span>
                      </>
                    ) : null}
                    <div className="chip-row">
                      <span className={getStatusClassName(order.status)}>
                        {orderStateMap[order.status].name}
                      </span>
                      {order.isLocked ? (
                        <span className="status-pill status-pill-slate">仍需解锁</span>
                      ) : null}
                      <span className="chip">
                        {order.abnormalContext?.currentSince || "暂无开始时间"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <strong>当前结果中没有异常订单。</strong>
                <span className="muted">如需只看异常单，可勾选“仅查看异常订单”。</span>
              </div>
            )}
          </div>

          <div className="version-card">
            <div className="table-cell-stack">
              <strong>最近恢复记录</strong>
              <span className="muted">
                展示当前结果中最近解除异常的订单，便于复盘恢复链路是否顺畅。
              </span>
            </div>
            {recentlyResolvedOrders.length > 0 ? (
              <ul className="timeline-list">
                {recentlyResolvedOrders.map((order) => (
                  <li key={`resolved-${order.id}`}>
                    <span className="timeline-title">
                      <Link href={`/orders/${order.id}`} className="table-link">
                        {order.orderNo}
                      </Link>
                      {" · "}
                      {order.customerName}
                    </span>
                    <span>
                      {order.abnormalContext?.latestResolvedReason || "异常已解除，恢复主流程处理。"}
                    </span>
                    <br />
                    <span className="muted">
                      {order.abnormalContext?.latestResolvedAt || "暂无时间"} ·{" "}
                      {order.abnormalContext?.latestResolvedOperator || "未知操作人"}
                    </span>
                    <br />
                    <span className="muted">
                      当前建议：{order.abnormalContext?.nextStep || "按主状态继续处理。"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <strong>当前结果中没有最近恢复记录。</strong>
                <span className="muted">异常解除后会在这里汇总展示，便于复盘处理效果。</span>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="低代码生效链路"
        title="已发布列表页配置"
        description="订单工作台当前只消费 /meta 中已发布的 order_extension_list 页面版本。草稿版本和未发布字段不会直接进入线上主表。"
      >
        {extensionListRuntime.ok ? (
          <div className="two-col-grid">
            <div className="version-card">
              <div className="table-cell-stack">
                <strong>当前生效版本</strong>
                <span className="muted">
                  {extensionListRuntime.entityCode} / {extensionListRuntime.pageCode} · 实体 v
                  {extensionListRuntime.entityVersion} · 页面 v{extensionListRuntime.pageVersion}
                </span>
              </div>
              <div className="kv-grid">
                <div>
                  <strong>配置总列数</strong>
                  <span>{extensionListRuntime.configuredColumnCount} 列</span>
                </div>
                <div>
                  <strong>基础列数</strong>
                  <span>{extensionListRuntime.builtinColumnCount} 列</span>
                </div>
                <div>
                  <strong>扩展列数</strong>
                  <span>{extensionListRuntime.activeColumnCount} 列</span>
                </div>
                <div>
                  <strong>当前结果数</strong>
                  <span>{orderResult.items.length} 条</span>
                </div>
                <div className="kv-grid-full">
                  <strong>加载说明</strong>
                  <span>{extensionListRuntime.message}</span>
                </div>
              </div>
            </div>

            <div className="version-card">
              <div className="table-cell-stack">
                <strong>发布约束</strong>
                <span className="muted">
                  当前已声明的基础列：{extensionListRuntime.builtinColumnCodes.join("、") || "无"}。
                </span>
              </div>
              {extensionListRuntime.warnings.length > 0 ? (
                <ul className="timeline-list">
                  {extensionListRuntime.warnings.map((warning) => (
                    <li key={warning}>
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state">
                  <strong>当前发布链路正常。</strong>
                  <span className="muted">
                    已发布页面引用的扩展列都能被运行时识别，未发布草稿不会污染订单工作台。
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <strong>{extensionListRuntime.message}</strong>
            <span className="muted">
              当前主表仍使用固定列展示；待列表页发布配置就绪后，会自动接入发布版扩展列。
            </span>
          </div>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="查询结果"
        title="订单工作台"
        description={`当前共返回 ${orderResult.total} 条订单。行内动作会根据登录角色权限动态变化。${
          extensionColumns.length > 0 ? `当前主表已加载 ${extensionColumns.length} 个发布版扩展列。` : ""
        }`}
      >
        {batchFeedback ? (
          <div className="batch-feedback-card">
            <div className="batch-feedback-summary">
              <div className="table-cell-stack">
                <strong>{getBatchActionLabel(batchFeedback.action)}执行结果</strong>
                <span className="muted">
                  生成时间：{batchFeedback.createdAt}，共 {batchFeedback.summary.total} 条，成功{" "}
                  {batchFeedback.summary.successCount} 条，失败{" "}
                  {batchFeedback.summary.failedCount} 条。
                </span>
              </div>
              <span
                className={
                  batchFeedback.summary.failedCount > 0
                    ? "status-pill status-pill-amber"
                    : "status-pill status-pill-green"
                }
              >
                {batchFeedback.summary.failedCount > 0 ? "部分成功" : "全部成功"}
              </span>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>订单</th>
                  <th>结果</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {batchFeedback.items.map((item) => (
                  <tr key={`${item.orderId}-${item.ok ? "ok" : "fail"}`}>
                    <td>
                      <div className="table-cell-stack">
                        <strong>{item.orderNo}</strong>
                        <span className="muted">{item.orderId}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={
                          item.ok
                            ? "status-pill status-pill-green"
                            : "status-pill status-pill-red"
                        }
                      >
                        {item.ok ? "成功" : "失败"}
                      </span>
                    </td>
                    <td>{item.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {canBatchManage ? (
          <form className="batch-panel" action="/api/orders/batch-actions" method="post">
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <div className="batch-panel-main">
              <label className="form-field">
                <span className="field-label">批量动作</span>
                <select className="select-input" name="action" defaultValue="approve-review">
                  {currentUser.permissions.includes("orders:review") ? (
                    <>
                      <option value="approve-review">批量审核通过</option>
                      <option value="lock-order">批量锁单</option>
                      <option value="unlock-order">批量解锁</option>
                    </>
                  ) : null}
                  {currentUser.permissions.includes("orders:ship") ? (
                    <option value="ship-order">批量发货</option>
                  ) : null}
                </select>
              </label>
              <label className="form-field batch-panel-note">
                <span className="field-label">操作原因</span>
                <input
                  className="text-input"
                  name="reason"
                  placeholder="锁单、解锁和批量发货建议填写原因"
                />
              </label>
              <label className="form-field">
                <span className="field-label">物流公司</span>
                <input
                  className="text-input"
                  name="shippingCompany"
                  placeholder="批量发货时填写，例如 顺丰速运"
                />
              </label>
              <label className="form-field">
                <span className="field-label">单号前缀</span>
                <input
                  className="text-input"
                  name="trackingPrefix"
                  placeholder="批量发货时用于生成单号，例如 SF202603"
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
                    {extensionColumns.map((column) => (
                      <th key={`batch-column-${column.fieldCode}`}>{column.name}</th>
                    ))}
                    <th>异常摘要</th>
                    <th>金额</th>
                    <th>创建时间</th>
                    <th>可执行操作</th>
                  </tr>
                </thead>
                <tbody>
                  {orderResult.items.map((order) => {
                    const state = orderStateMap[order.status];
                    const actions = getOrderAvailableActions(order, currentUser.permissions);
                    const abnormalSummary = getAbnormalSummary(order);

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
                            {order.isAbnormal && order.abnormalContext?.currentReason ? (
                              <span className="muted">
                                原因：{order.abnormalContext.currentReason}
                              </span>
                            ) : null}
                            {order.isAbnormal && order.abnormalContext?.nextStep ? (
                              <span className="muted">
                                建议：{order.abnormalContext.nextStep}
                              </span>
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
                        {extensionColumns.map((column) => {
                          const cell = column.cellsByOrderId[order.id];

                          return (
                            <td key={`${order.id}-${column.fieldCode}`}>
                              <div className="table-cell-stack">
                                <strong>{cell?.displayValue ?? "未配置"}</strong>
                                <span className="muted">
                                  {cell?.sourceLabel ?? "当前没有可用来源。"}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                        <td>
                          <div className="table-cell-stack">
                            <strong>{abnormalSummary.title}</strong>
                            <span className="muted">{abnormalSummary.detail}</span>
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
                {extensionColumns.map((column) => (
                  <th key={`readonly-column-${column.fieldCode}`}>{column.name}</th>
                ))}
                <th>异常摘要</th>
                <th>金额</th>
                <th>创建时间</th>
                <th>可执行操作</th>
              </tr>
            </thead>
            <tbody>
              {orderResult.items.map((order) => {
                const state = orderStateMap[order.status];
                const actions = getOrderAvailableActions(order, currentUser.permissions);
                const abnormalSummary = getAbnormalSummary(order);

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
                        {order.isAbnormal && order.abnormalContext?.currentReason ? (
                          <span className="muted">
                            原因：{order.abnormalContext.currentReason}
                          </span>
                        ) : null}
                        {order.isAbnormal && order.abnormalContext?.nextStep ? (
                          <span className="muted">
                            建议：{order.abnormalContext.nextStep}
                          </span>
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
                    {extensionColumns.map((column) => {
                      const cell = column.cellsByOrderId[order.id];

                      return (
                        <td key={`${order.id}-${column.fieldCode}`}>
                          <div className="table-cell-stack">
                            <strong>{cell?.displayValue ?? "未配置"}</strong>
                            <span className="muted">
                              {cell?.sourceLabel ?? "当前没有可用来源。"}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                    <td>
                      <div className="table-cell-stack">
                        <strong>{abnormalSummary.title}</strong>
                        <span className="muted">{abnormalSummary.detail}</span>
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
