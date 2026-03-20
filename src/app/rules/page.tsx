import { SectionCard } from "@/components/ui/section-card";
import {
  ruleNodeTypes,
  ruleScenes
} from "@/features/rules/config/rule-scenes";

export default function RulesPage() {
  return (
    <div className="page-grid">
      <header className="app-header">
        <div>
          <h1 className="app-header-title">规则编排引擎</h1>
          <p className="app-header-subtitle">
            本期规则引擎定位为订单业务决策流，不是通用审批系统。初始化先把场景、节点和版本管理规则定下来。
          </p>
        </div>
        <div className="app-header-meta">同步执行 / 试运行 / 发布 / 回滚</div>
      </header>

      <div className="two-col-grid">
        <SectionCard
          eyebrow="触发场景"
          title="规则触发点"
          description="场景先围绕订单审核和分仓决策收敛，避免第一版过重。"
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
          title="初始化建议支持的节点"
          description="优先把同步条件判断和动作执行做稳，再考虑复杂节点。"
        >
          <div className="chip-row">
            {ruleNodeTypes.map((nodeType) => (
              <span key={nodeType} className="chip">
                {nodeType}
              </span>
            ))}
          </div>
          <ul className="bullet-list">
            <li>开始节点定义输入上下文和触发场景。</li>
            <li>条件与分支节点负责字段判断和路径路由。</li>
            <li>动作节点负责写状态、标签、备注和仓库结果。</li>
            <li>结果节点输出自动通过、转人工和拦截等最终结果。</li>
          </ul>
        </SectionCard>
      </div>

      <SectionCard
        eyebrow="版本管理"
        title="规则发布约束"
        description="规则必须具备试运行、版本保存和历史可追踪能力，否则无法解释线上结果。"
      >
        <ul className="timeline-list">
          <li>
            <span className="timeline-title">试运行</span>
            使用样例订单或指定订单做模拟执行，查看命中路径和输出结果。
          </li>
          <li>
            <span className="timeline-title">发布</span>
            每次发布生成独立版本，不覆盖历史图结构。
          </li>
          <li>
            <span className="timeline-title">回滚</span>
            可以重新激活旧版本，并在订单详情看到命中的版本号。
          </li>
        </ul>
      </SectionCard>
    </div>
  );
}
