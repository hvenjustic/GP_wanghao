import Link from "next/link";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionCard } from "@/components/ui/section-card";
import { hasPermission } from "@/lib/auth/types";
import { requirePermission } from "@/lib/auth/guards";
import {
  ruleActionOptions,
  ruleConditionOperators,
  ruleExpressionExamples,
  ruleExpressionGroupOptions,
  ruleExpressionTypeOptions,
  ruleFieldOptions,
  ruleNodeConfigSemantics,
  ruleNodeConfigTemplates,
  ruleNodeTemplates,
  ruleNodeTypes,
  ruleScenes
} from "@/features/rules/config/rule-scenes";
import { RuleDesigner } from "@/features/rules/components/rule-designer";
import { getRuleManagementOverview } from "@/server/services/rule-service";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getRuleStatusClassName(status: string) {
  switch (status) {
    case "PUBLISHED":
      return "status-pill status-pill-green";
    case "DISABLED":
      return "status-pill status-pill-slate";
    case "DRAFT":
      return "status-pill status-pill-amber";
    default:
      return "status-pill status-pill-blue";
  }
}

function buildRuleHref(ruleId: string, versionId?: string, anchor?: string) {
  const query = new URLSearchParams();
  query.set("ruleId", ruleId);

  if (versionId) {
    query.set("versionId", versionId);
  }

  return `/rules?${query.toString()}${anchor ? `#${anchor}` : ""}`;
}

function getExampleRuleNarrative(ruleCode: string) {
  switch (ruleCode) {
    case "RULE_AUTO_APPROVE":
      return {
        title: "审核样例",
        summary: "低风险订单自动审核通过，直接推进到待分仓。",
        chain: [
          "开始节点：声明场景为“订单创建后”",
          "条件节点：组合表达式校验金额、支付状态、锁单和异常状态",
          "动作节点：`approve-review + append-tag`",
          "结果节点：输出“进入待分仓”"
        ]
      };
    case "RULE_WAREHOUSE_PRIORITY":
      return {
        title: "分仓样例",
        summary: "审核通过后按区域分支，把订单路由到华东、华南或默认仓。",
        chain: [
          "开始节点：声明场景为“审核通过后”",
          "分支节点：按 `receiver.province` 路由区域",
          "动作节点：分别执行 `assign-warehouse` 到目标仓",
          "结果节点：统一输出分仓结果"
        ]
      };
    case "RULE_SHIPMENT_EXPRESS_GUARD":
      return {
        title: "发货前样例",
        summary: "加急订单进入物流公司分支，不符合顺丰要求时自动锁单，否则直接放行。",
        chain: [
          "开始节点：声明场景为“发货前校验”",
          "条件节点：`expression.group(or)` 判断加急履约",
          "分支节点：按 `payload.shippingCompany` 路由放行或拦截",
          "动作节点：`lock-order + mark-abnormal + append-tag + set-note`"
        ]
      };
    case "RULE_MANUAL_RETRY_RECHECK":
      return {
        title: "人工重跑样例",
        summary: "人工处理后重新评估异常和锁单状态，决定继续人工处理还是恢复自动履约。",
        chain: [
          "开始节点：声明场景为“人工重跑”",
          "分支节点：按 `isAbnormal / isLocked / tags` 判断是否仍需人工复核",
          "动作节点：命中恢复路径时执行 `clear-abnormal + unlock-order + approve-review`",
          "结果节点：输出“继续人工处理”或“恢复待分仓”"
        ]
      };
    default:
      return {
        title: "规则样例",
        summary: "当前规则可用于演示配置、发布和执行链路。",
        chain: []
      };
  }
}

export default async function RulesPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const currentUser = await requirePermission("rules:view", "/rules");
  const params = await searchParams;
  const notice = getSingleValue(params.notice);
  const error = getSingleValue(params.error);
  const selectedRuleId = getSingleValue(params.ruleId);
  const selectedVersionId = getSingleValue(params.versionId);
  const overview = await getRuleManagementOverview({
    ruleId: selectedRuleId,
    versionId: selectedVersionId
  });
  const canManage = hasPermission(currentUser, "rules:manage");
  const exampleRules = [
    "RULE_AUTO_APPROVE",
    "RULE_WAREHOUSE_PRIORITY",
    "RULE_SHIPMENT_EXPRESS_GUARD",
    "RULE_MANUAL_RETRY_RECHECK"
  ]
    .map((code) => overview.rules.find((rule) => rule.ruleCode === code) ?? null)
    .filter((rule): rule is NonNullable<typeof overview.rules[number]> => Boolean(rule));

  return (
    <div className="page-grid">
      <header className="app-header">
        <div>
          <h1 className="app-header-title">规则编排引擎</h1>
          <p className="app-header-subtitle">
            支持规则定义、版本管理、可视化设计、试运行、发布、回滚和执行日志查询。
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
          label="规则数量"
          value={`${overview.summary.totalRules} 条`}
          hint="当前数据库中的规则定义总数。"
        />
        <MetricCard
          label="已发布规则"
          value={`${overview.summary.publishedRules} 条`}
          hint="至少有一个已激活版本的规则。"
        />
        <MetricCard
          label="规则版本"
          value={`${overview.summary.totalVersions} 个`}
          hint="包含历史已发布版本和当前草稿版本。"
        />
        <MetricCard
          label="试运行记录"
          value={`${overview.summary.totalRuns} 条`}
          hint="试运行和线上执行都会沉淀到规则日志。"
        />
      </div>

      <div className="two-col-grid">
        <SectionCard
          eyebrow="触发场景"
          title="规则触发点"
          description="按订单处理场景配置审核、分仓、发货校验和人工重跑规则。"
        >
          <table className="data-table">
            <thead>
              <tr>
                <th>场景</th>
                <th>用途</th>
                <th>优先级</th>
              </tr>
            </thead>
            <tbody>
              {ruleScenes.map((scene) => (
                <tr key={scene.scene}>
                  <td>{scene.scene}</td>
                  <td>{scene.goal}</td>
                  <td>{scene.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard
          eyebrow="节点模型"
          title="设计器支持的节点"
          description="通过开始、条件、分支、动作、结果和计算节点描述规则执行路径。"
        >
          <div className="chip-row">
            {ruleNodeTypes.map((nodeType) => (
              <span key={nodeType} className="chip">
                {nodeType}
              </span>
            ))}
          </div>
          <ul className="timeline-list">
            {ruleNodeTemplates.map((template) => (
              <li key={template.kind}>
                <span className="timeline-title">{template.label}</span>
                {template.detail}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard
        eyebrow="节点语义"
        title="规则节点配置 JSON 约定"
        description="统一说明字段路径、条件表达式、操作符和动作语义的配置方式。"
      >
        <div className="two-col-grid">
          <div className="version-card">
            <div className="table-cell-stack">
              <strong>常用条件字段</strong>
              <span className="muted">
                字段路径支持订单主字段、扩展字段和动作入参上下文，例如 `payload.shippingCompany`。
              </span>
            </div>
            <div className="chip-row">
              {ruleFieldOptions.map((field) => (
                <span key={field} className="chip">
                  {field}
                </span>
              ))}
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>操作符</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {ruleConditionOperators.map((operator) => (
                  <tr key={operator.value}>
                    <td>{operator.value}</td>
                    <td>
                      <div className="table-cell-stack">
                        <strong>{operator.label}</strong>
                        <span className="muted">{operator.description}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="version-card">
            <div className="table-cell-stack">
              <strong>表达式结构</strong>
              <span className="muted">
                条件节点优先使用 `expression` 字段，支持 comparison、group、not 三类表达式。
              </span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>类型</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {ruleExpressionTypeOptions.map((item) => (
                  <tr key={item.value}>
                    <td>{item.value}</td>
                    <td>
                      <div className="table-cell-stack">
                        <strong>{item.label}</strong>
                        <span className="muted">{item.description}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="data-table">
              <thead>
                <tr>
                  <th>组合方式</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {ruleExpressionGroupOptions.map((item) => (
                  <tr key={item.value}>
                    <td>{item.value}</td>
                    <td>
                      <div className="table-cell-stack">
                        <strong>{item.label}</strong>
                        <span className="muted">{item.description}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="two-col-grid">
          <div className="version-card">
            <div className="table-cell-stack">
              <strong>可执行动作</strong>
              <span className="muted">动作节点支持串行动作数组，可直接落到锁单、审核、分仓、标签和备注写入。</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>动作</th>
                  <th>业务语义</th>
                </tr>
              </thead>
              <tbody>
                {ruleActionOptions.map((action) => (
                  <tr key={action.value}>
                    <td>{action.value}</td>
                    <td>
                      <div className="table-cell-stack">
                        <strong>{action.label}</strong>
                        <span className="muted">{action.description}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="version-card">
            <div className="table-cell-stack">
              <strong>节点语义说明</strong>
              {ruleNodeTemplates.map((template) => (
                <div key={template.kind} className="table-cell-stack">
                  <span className="timeline-title">{template.label}</span>
                  {ruleNodeConfigSemantics[template.kind].map((item) => (
                    <span key={`${template.kind}-${item}`} className="muted">
                      {item}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="version-card">
            <div className="table-cell-stack">
              <strong>推荐 JSON 模板</strong>
              <span className="muted">
                设计器右侧选中节点后，可以直接载入对应模板，再调整表达式、字段和值。分支节点的
                `target` / `defaultTarget` 必须填写当前分支节点已连接下游节点的 ID。
              </span>
            </div>
            {ruleNodeTemplates.map((template) => (
              <div key={`template-${template.kind}`} className="table-cell-stack">
                <span className="timeline-title">{template.label}</span>
                <pre className="code-block">
                  {JSON.stringify(
                    template.kind === "start"
                      ? {
                          ...ruleNodeConfigTemplates.start,
                          scene: "发货前校验"
                        }
                      : ruleNodeConfigTemplates[template.kind],
                    null,
                    2
                  )}
                </pre>
              </div>
            ))}
            <div className="table-cell-stack">
              <span className="timeline-title">表达式模板</span>
              <pre className="code-block">
                {JSON.stringify(
                  {
                    comparison: ruleExpressionExamples.comparison,
                    group: ruleExpressionExamples.group,
                    not: ruleExpressionExamples.not
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="示例规则"
        title="内置业务规则样例"
        description="展示审核、分仓、发货前校验和人工重跑等典型规则场景。"
      >
        {exampleRules.length > 0 ? (
          <div className="version-group-list">
            {exampleRules.map((rule) => {
              const narrative = getExampleRuleNarrative(rule.ruleCode);

              return (
                <article key={rule.id} className="version-card">
                  <div className="table-cell-stack">
                    <strong>{narrative.title} · {rule.name}</strong>
                    <span className="muted">{rule.ruleCode}</span>
                    <span className="status-pill status-pill-green">
                      {rule.scene} · {rule.status}
                    </span>
                    <span className="muted">{narrative.summary}</span>
                  </div>

                  <div className="action-stack">
                    <Link
                      href={buildRuleHref(rule.id, rule.activeVersionId ?? undefined, "designer")}
                      className="button-primary"
                    >
                      打开示例规则
                    </Link>
                    <Link
                      href={`/rule-logs?ruleCode=${encodeURIComponent(rule.ruleCode)}`}
                      className="button-secondary"
                    >
                      查看示例日志
                    </Link>
                  </div>

                  <div className="table-cell-stack">
                    <strong>推荐链路</strong>
                    {narrative.chain.map((item) => (
                      <span key={`${rule.ruleCode}-${item}`} className="muted">
                        {item}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <strong>当前数据库还没有规则数据。</strong>
            <span className="muted">请先初始化规则定义和版本数据。</span>
          </div>
        )}
      </SectionCard>

      {!canManage ? (
        <div className="alert-banner">
          当前账号只有查看权限，不能新建规则或保存画布。如需设计、发布或试运行规则，请使用具备 `rules:manage` 的账号。
        </div>
      ) : null}

      <div id="rule-catalog">
        <SectionCard
          eyebrow="规则目录"
          title="规则定义与版本入口"
          description="先创建规则定义，再在下方版本卡片和画布设计器里维护各个版本。"
          extra={
            <Link
              href={
                overview.selectedRule
                  ? `/rule-logs?ruleCode=${encodeURIComponent(overview.selectedRule.ruleCode)}`
                  : "/rule-logs"
              }
              className="button-secondary"
            >
              查看规则日志
            </Link>
          }
        >
        {canManage ? (
          <form className="meta-form-grid" action="/api/rules/definitions" method="post">
            <input type="hidden" name="action" value="create" />
            <label className="form-field">
              <span className="field-label">规则编码</span>
              <input
                className="text-input"
                name="ruleCode"
                placeholder="例如 RULE_ORDER_REVIEW"
                required
              />
            </label>
            <label className="form-field">
              <span className="field-label">规则名称</span>
              <input className="text-input" name="name" placeholder="例如 订单基础审核" required />
            </label>
            <label className="form-field">
              <span className="field-label">规则类型</span>
              <select
                className="select-input"
                name="type"
                defaultValue={overview.options.typeOptions[0]}
              >
                {overview.options.typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span className="field-label">触发场景</span>
              <select
                className="select-input"
                name="scene"
                defaultValue={overview.options.sceneOptions[0]}
              >
                {overview.options.sceneOptions.map((scene) => (
                  <option key={scene} value={scene}>
                    {scene}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-actions meta-form-actions">
              <button type="submit" className="button-primary">
                新增规则
              </button>
            </div>
          </form>
        ) : null}

        <table className="data-table">
          <thead>
            <tr>
              <th>规则</th>
              <th>类型 / 场景 / 状态</th>
              <th>版本概览</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {overview.rules.length > 0 ? (
              overview.rules.map((rule) => (
                <tr
                  key={rule.id}
                  className={overview.selectedRule?.id === rule.id ? "data-table-row-selected" : undefined}
                >
                  <td>
                    <Link
                      href={buildRuleHref(rule.id, rule.activeVersionId ?? undefined)}
                      className="table-row-link"
                    >
                      <div className="table-cell-stack">
                        <strong>{rule.name}</strong>
                        <span className="muted">{rule.ruleCode}</span>
                      </div>
                    </Link>
                  </td>
                  <td>
                    <Link
                      href={buildRuleHref(rule.id, rule.activeVersionId ?? undefined)}
                      className="table-row-link"
                    >
                      <div className="table-cell-stack">
                        <span className="status-pill status-pill-blue">{rule.type}</span>
                        <span>{rule.scene}</span>
                        <span className={getRuleStatusClassName(rule.status)}>{rule.status}</span>
                      </div>
                    </Link>
                  </td>
                  <td>
                    <Link
                      href={buildRuleHref(rule.id, rule.activeVersionId ?? undefined)}
                      className="table-row-link"
                    >
                      <div className="table-cell-stack">
                        <span>{rule.versionCount} 个版本</span>
                        <span className="muted">
                          {rule.activeVersion ? `当前线上 v${rule.activeVersion}` : "尚未发布"}
                        </span>
                        <span className="muted">草稿 {rule.draftCount} 个</span>
                      </div>
                    </Link>
                  </td>
                  <td>
                    <Link
                      href={buildRuleHref(rule.id, rule.activeVersionId ?? undefined)}
                      className="table-row-link"
                    >
                      {rule.updatedAt}
                    </Link>
                  </td>
                  <td>
                    <div className="action-stack">
                      <Link
                        href={buildRuleHref(rule.id, rule.activeVersionId ?? undefined, "designer")}
                        className="button-secondary"
                      >
                        打开设计器
                      </Link>
                      <Link
                        href={`/rule-logs?ruleCode=${encodeURIComponent(rule.ruleCode)}`}
                        className="button-secondary"
                      >
                        执行日志
                      </Link>
                      {canManage && overview.selectedRule?.id === rule.id ? (
                        <form action="/api/rules/definitions" method="post">
                          <input type="hidden" name="action" value="delete" />
                          <input type="hidden" name="id" value={rule.id} />
                          <button type="submit" className="button-danger">
                            删除规则
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    <strong>当前还没有规则定义。</strong>
                    <span className="muted">先创建一条规则，规则设计器和版本卡片才会出现内容。</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </SectionCard>
      </div>

      {overview.selectedRule ? (
        <>
          <div id="rule-config">
            <SectionCard
              eyebrow="规则配置"
              title={`${overview.selectedRule.name} · ${overview.selectedRule.ruleCode}`}
              description="规则定义层负责编码、名称、状态和启停治理；真正可运行的结构在版本和画布里维护。"
            >
            <div className="two-col-grid">
              <div className="version-card">
                <div className="table-cell-stack">
                  <strong>当前规则信息</strong>
                  <span className={getRuleStatusClassName(overview.selectedRule.status)}>
                    {overview.selectedRule.status}
                  </span>
                  <span className="muted">
                    {overview.selectedRule.type} · {overview.selectedRule.scene}
                  </span>
                  <span className="muted">
                    {overview.selectedRule.activeVersion
                      ? `当前线上版本 v${overview.selectedRule.activeVersion}`
                      : "当前没有线上版本"}
                  </span>
                  <span className="muted">
                    发布历史 {overview.selectedRule.publishedHistoryCount} 次
                  </span>
                  <span className="muted">最近更新：{overview.selectedRule.updatedAt}</span>
                  <span className="muted">{overview.selectedRule.governanceHint}</span>
                </div>
              </div>

              {canManage ? (
                <form className="version-card" action="/api/rules/definitions" method="post">
                  <input type="hidden" name="action" value="update" />
                  <input type="hidden" name="id" value={overview.selectedRule.id} />
                  <label className="form-field">
                    <span className="field-label">规则编码</span>
                    <input
                      className="text-input"
                      name="ruleCode"
                      defaultValue={overview.selectedRule.ruleCode}
                      required
                    />
                  </label>
                  <label className="form-field">
                    <span className="field-label">规则名称</span>
                    <input
                      className="text-input"
                      name="name"
                      defaultValue={overview.selectedRule.name}
                      required
                    />
                  </label>
                  <label className="form-field">
                    <span className="field-label">规则类型</span>
                    <select
                      className="select-input"
                      name="type"
                      defaultValue={overview.selectedRule.type}
                    >
                      {overview.options.typeOptions.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span className="field-label">触发场景</span>
                    <select
                      className="select-input"
                      name="scene"
                      defaultValue={overview.selectedRule.scene}
                    >
                      {overview.options.sceneOptions.map((scene) => (
                        <option key={scene} value={scene}>
                          {scene}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="form-actions">
                    <button type="submit" className="button-secondary">
                      保存规则定义
                    </button>
                  </div>
                </form>
              ) : null}
            </div>

            <div className="two-col-grid">
              <div className="version-card">
                <div className="table-cell-stack">
                  <strong>治理约束</strong>
                  <span className="muted">
                    停用后的规则不会参与线上自动执行，但仍保留版本、日志和试运行记录。
                  </span>
                  <span className="muted">
                    已停用规则必须先启用，才能继续发布或回滚版本。
                  </span>
                  <span className="muted">
                    回滚目标必须是历史已发布版本；没有发布历史的规则不能直接删除。
                  </span>
                </div>
              </div>

              {canManage ? (
                <div className="version-card">
                  <div className="table-cell-stack">
                    <strong>启停治理</strong>
                    <span className="muted">
                      当前状态：{overview.selectedRule.status}
                    </span>
                  </div>

                  {overview.selectedRule.status === "DISABLED" ? (
                    <form className="action-stack" action="/api/rules/definitions" method="post">
                      <input type="hidden" name="action" value="enable" />
                      <input type="hidden" name="id" value={overview.selectedRule.id} />
                      <input
                        className="text-input"
                        name="reason"
                        placeholder="启用说明，可选"
                      />
                      <button type="submit" className="button-primary">
                        启用规则
                      </button>
                    </form>
                  ) : (
                    <form className="action-stack" action="/api/rules/definitions" method="post">
                      <input type="hidden" name="action" value="disable" />
                      <input type="hidden" name="id" value={overview.selectedRule.id} />
                      <input
                        className="text-input"
                        name="reason"
                        placeholder="停用原因，必填"
                        required
                      />
                      <button type="submit" className="button-danger">
                        停用规则
                      </button>
                    </form>
                  )}
                </div>
              ) : null}
            </div>
            </SectionCard>
          </div>

          <div id="rule-versions">
            <SectionCard
              eyebrow="版本治理"
              title="规则版本、发布与回滚"
              description="规则版本默认不可直接覆盖线上版本；对当前发布版本做编辑时，保存会自动另存为新草稿。"
            >
            {overview.versionItems.length > 0 ? (
              <div className="version-group-list">
                {overview.versionItems.map((version) => (
                  <article key={version.id} className="version-card">
                    <div className="version-card-header">
                      <div className="table-cell-stack">
                        <strong>v{version.version}</strong>
                        <span className={version.isActive ? "status-pill status-pill-green" : "status-pill status-pill-amber"}>
                          {version.isActive ? "线上版本" : "草稿 / 历史"}
                        </span>
                        <span className="muted">
                          {version.nodeCount} 节点 · {version.edgeCount} 连线 · {version.execCount} 次执行
                        </span>
                        <span className="muted">{version.updatedAt}</span>
                        <span className="muted">
                          {version.publishedAt !== "-" ? `${version.publishMode} · ${version.publishedAt}` : "尚未激活"}
                        </span>
                        {version.publishNote ? <span className="muted">{version.publishNote}</span> : null}
                      </div>
                      <Link
                        href={buildRuleHref(overview.selectedRule?.id ?? "", version.id, "designer")}
                        className="button-secondary"
                      >
                        选择此版本
                      </Link>
                    </div>

                    <div className="chip-row">
                      {version.labels.map((label) => (
                        <span key={`${version.id}-${label}`} className="chip">
                          {label}
                        </span>
                      ))}
                    </div>

                    <div className="muted">{version.pathPreview}</div>

                    {canManage ? (
                      <div className="action-stack">
                        <form className="inline-form" action="/api/rules/versions" method="post">
                          <input type="hidden" name="action" value="clone-version" />
                          <input type="hidden" name="versionId" value={version.id} />
                          <input
                            className="text-input input-compact"
                            name="targetVersion"
                            type="number"
                            min={version.version + 1}
                            placeholder="新版本号，可留空"
                          />
                          <input
                            className="text-input input-compact"
                            name="note"
                            placeholder="克隆备注，可选"
                          />
                          <button type="submit" className="button-secondary">
                            克隆版本
                          </button>
                        </form>

                        {overview.selectedRule?.status === "DISABLED" ? (
                          <div className="empty-state">
                            <strong>当前规则已停用。</strong>
                            <span className="muted">请先在上方启用规则，再执行发布或回滚。</span>
                          </div>
                        ) : !version.isActive ? (
                          <>
                            <form className="inline-form" action="/api/rules/versions" method="post">
                              <input type="hidden" name="action" value="publish" />
                              <input type="hidden" name="versionId" value={version.id} />
                              <input
                                className="text-input input-compact"
                                name="note"
                                placeholder="发布备注，可选"
                              />
                              <button type="submit" className="button-primary">
                                发布此版本
                              </button>
                            </form>

                            <form className="inline-form" action="/api/rules/versions" method="post">
                              <input type="hidden" name="action" value="rollback" />
                              <input type="hidden" name="versionId" value={version.id} />
                              <input
                                className="text-input"
                                name="reason"
                                placeholder="回滚原因，必填"
                                required
                              />
                              <button type="submit" className="button-danger">
                                回滚到此版本
                              </button>
                            </form>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <strong>当前规则还没有版本。</strong>
                <span className="muted">创建规则后会自动生成一个初始草稿版本。</span>
              </div>
            )}
            </SectionCard>
          </div>

          <div id="designer">
            <SectionCard
              eyebrow="规则设计器"
              title={
                overview.selectedVersion
                  ? `当前编辑版本 v${overview.selectedVersion.version}`
                  : "规则设计器"
              }
              description="画布中维护的是 RuleVersion.graph。已发布版本保存时会自动另存为新草稿，避免直接改线上图结构。"
            >
              {overview.selectedVersion ? (
                <>
                  <div className="two-col-grid">
                    <div className="version-card">
                      <div className="table-cell-stack">
                        <strong>当前版本信息</strong>
                        <span
                          className={
                            overview.selectedVersion.isActive
                              ? "status-pill status-pill-green"
                              : "status-pill status-pill-amber"
                          }
                        >
                          {overview.selectedVersion.isActive ? "线上版本" : "草稿 / 历史"}
                        </span>
                        <span className="muted">
                          {overview.selectedVersion.nodeCount} 节点 · {overview.selectedVersion.edgeCount} 连线
                        </span>
                        <span className="muted">{overview.selectedVersion.pathPreview}</span>
                        <span className="muted">
                          {overview.selectedVersion.publishedAt !== "-"
                            ? `${overview.selectedVersion.publishMode} · ${overview.selectedVersion.publishedAt} · ${overview.selectedVersion.publishedBy}`
                            : "当前版本尚未激活"}
                        </span>
                      </div>
                    </div>

                    <div className="version-card">
                      <div className="table-cell-stack">
                        <strong>设计器约束</strong>
                        <span className="muted">开始节点定义触发场景，动作和结果节点决定试运行输出。</span>
                        <span className="muted">分支节点按配置顺序匹配 `branches`，`target` 必须是已连接的下游节点 ID。</span>
                        <span className="muted">建议先克隆线上版本，再在新草稿里调整节点和连线。</span>
                        <span className="muted">保存后会重新写入数据库，并可立即试运行。</span>
                      </div>
                    </div>
                  </div>

                  <form className="action-stack" action="/api/rules/versions" method="post">
                    <input type="hidden" name="action" value="save-draft" />
                    <input type="hidden" name="versionId" value={overview.selectedVersion.id} />
                    <RuleDesigner
                      key={overview.selectedVersion.id}
                      inputName="graphText"
                      initialGraphText={overview.selectedVersion.graphText}
                      scene={overview.selectedRule.scene}
                      readOnly={!canManage}
                    />

                    {canManage ? (
                      <div className="inline-form">
                        <input
                          className="text-input input-compact"
                          name="targetVersion"
                          type="number"
                          min={overview.selectedVersion.version + 1}
                          placeholder="另存版本号，可留空"
                        />
                        <input
                          className="text-input"
                          name="note"
                          placeholder={
                            overview.selectedVersion.isActive
                              ? "保存备注，可选；线上版本会自动另存为新草稿"
                              : "保存备注，可选"
                          }
                        />
                        <button type="submit" className="button-primary">
                          保存设计器变更
                        </button>
                      </div>
                    ) : null}
                  </form>
                </>
              ) : (
                <div className="empty-state">
                  <strong>当前没有可编辑的规则版本。</strong>
                  <span className="muted">请先在上方选择一条规则和版本。</span>
                </div>
              )}
            </SectionCard>
          </div>

          <div id="test-run">
            <SectionCard
              eyebrow="试运行"
              title="样例输入与最近执行"
              description="试运行会把输入、输出和命中路径写入规则日志，便于发布前验证图结构。"
            >
            {overview.selectedVersion ? (
              <div className="two-col-grid">
                <form className="version-card" action="/api/rules/test-runs" method="post">
                  <input type="hidden" name="versionId" value={overview.selectedVersion.id} />
                  <label className="form-field">
                    <span className="field-label">关联订单 ID</span>
                    <input
                      className="text-input"
                      name="orderId"
                      placeholder="可留空，例如 order-001"
                    />
                  </label>
                  <label className="form-field">
                    <span className="field-label">样例输入 JSON</span>
                    <textarea
                      className="textarea-input"
                      name="sampleInputText"
                      defaultValue={overview.defaultTestInput}
                      required
                    />
                  </label>
                  {canManage ? (
                    <div className="form-actions">
                      <button type="submit" className="button-primary">
                        运行当前版本
                      </button>
                    </div>
                  ) : null}
                </form>

                <div className="version-card">
                  {overview.recentRuns.length > 0 ? (
                    <ul className="timeline-list">
                      {overview.recentRuns.map((run) => (
                        <li key={run.id}>
                          <span className="timeline-title">
                            {run.versionLabel} · {run.status} · {run.createdAt}
                          </span>
                          订单 {run.orderId} · {run.durationMs}ms
                          <div className="table-cell-stack">
                            {run.resultEntries.map((entry) => (
                              <span key={`${run.id}-${entry}`} className="muted">
                                {entry}
                              </span>
                            ))}
                            {run.inputEntries.map((entry) => (
                              <span key={`${run.id}-input-${entry}`} className="muted">
                                入参：{entry}
                              </span>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="empty-state">
                      <strong>当前规则还没有试运行记录。</strong>
                      <span className="muted">运行一次样例后，这里会展示输入输出和命中结果。</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <strong>请选择一个规则版本后再试运行。</strong>
                <span className="muted">试运行依赖版本图结构和样例输入。</span>
              </div>
            )}
            </SectionCard>
          </div>
        </>
      ) : null}
    </div>
  );
}
