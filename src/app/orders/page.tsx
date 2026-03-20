import { SectionCard } from "@/components/ui/section-card";
import { orderStates } from "@/features/orders/config/order-states";

function getToneClass(tone: string) {
  return `status-pill status-pill-${tone}`;
}

export default function OrdersPage() {
  return (
    <div className="page-grid">
      <header className="app-header">
        <div>
          <h1 className="app-header-title">订单管理后台</h1>
          <p className="app-header-subtitle">
            这个页面当前用于承接订单模块的初始化设计，已经把状态模型、关键动作和异常处理边界落到了代码目录中。
          </p>
        </div>
        <div className="app-header-meta">列表页 / 详情页 / 批量处理 / 日志追踪</div>
      </header>

      <div className="two-col-grid">
        <SectionCard
          eyebrow="状态模型"
          title="订单主状态"
          description="主状态用于驱动列表过滤、详情展示和允许执行的业务动作。"
        >
          <table className="data-table">
            <thead>
              <tr>
                <th>状态</th>
                <th>编码</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {orderStates.map((state) => (
                <tr key={state.code}>
                  <td>
                    <span className={getToneClass(state.tone)}>{state.name}</span>
                  </td>
                  <td>{state.code}</td>
                  <td>{state.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard
          eyebrow="操作约束"
          title="初始化阶段需要固定的规则"
          description="这些约束建议在 service 层先实现，避免 UI 直接决定业务正确性。"
        >
          <ul className="timeline-list">
            <li>
              <span className="timeline-title">审核通过</span>
              非锁单且必要字段完整时，订单从待审核流转到待分仓。
            </li>
            <li>
              <span className="timeline-title">审核驳回</span>
              需要记录驳回原因并进入已取消，后续保留日志和版本追踪。
            </li>
            <li>
              <span className="timeline-title">发货</span>
              仅允许待发货订单执行，且必须具备物流公司和物流单号。
            </li>
            <li>
              <span className="timeline-title">人工覆盖</span>
              人工动作可以覆盖规则结果，但必须写入人工覆盖标记和原因。
            </li>
          </ul>
        </SectionCard>
      </div>

      <SectionCard
        eyebrow="后续实现"
        title="建议优先补齐的文件"
        description="订单模块现在已经有目录和页面入口，下一步应开始补 service、route handler 和页面组件。"
      >
        <pre className="code-block">{`src/features/orders/
  components/
  hooks/
  services/

src/app/orders/
  page.tsx
  [id]/page.tsx

src/server/services/
  order-service.ts`}</pre>
      </SectionCard>
    </div>
  );
}
