import type { AuthSession } from "@/lib/auth/types";
import Link from "next/link";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionCard } from "@/components/ui/section-card";
import { metaCapabilities } from "@/features/meta/config/meta-capabilities";
import { orderStates } from "@/features/orders/config/order-states";
import { ruleScenes } from "@/features/rules/config/rule-scenes";
import {
  getBootstrapChecklist,
  getDashboardMetrics
} from "@/server/services/dashboard-service";

export function DashboardHome({ currentUser }: { currentUser: AuthSession }) {
  const metrics = getDashboardMetrics();
  const checklist = getBootstrapChecklist();

  return (
    <div className="page-grid">
      <header className="app-header">
        <div>
          <h1 className="app-header-title">P0 主线推进中</h1>
          <p className="app-header-subtitle">
            当前仓库已经完成远程数据库初始化，并开始把登录权限和订单状态流转正式切到数据库。
            当前登录账号为 {currentUser.name}，角色是 {currentUser.roleName}。
          </p>
        </div>
        <div className="app-header-meta">Next.js App Router + PostgreSQL + Prisma</div>
      </header>

      <section className="hero-panel">
        <h2 className="hero-title">先把工程骨架立起来，再沿需求文档逐步填实业务能力</h2>
        <p className="hero-copy">
          这套初始化不追求一次性把所有实现做完，而是优先解决目录组织、运行入口、基础配置、
          数据模型和后续扩展位。你现在可以直接在订单、配置、规则三个模块上继续分层开发。
        </p>
      </section>

      <div className="stats-grid">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            hint={metric.hint}
          />
        ))}
      </div>

      <div className="feature-grid">
        <SectionCard
          eyebrow="订单后台"
          title="订单状态与工作台骨架"
          description="先把状态模型、核心动作和日志视角固定下来，后续再接真实数据。"
        >
          <div className="chip-row">
            {orderStates.slice(0, 4).map((state) => (
              <span key={state.code} className="chip">
                {state.name}
              </span>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="低代码配置"
          title="配置平台边界已收敛"
          description="实体、字段、页面和动作配置已经拆成独立模块，便于继续抽象。"
        >
          <div className="chip-row">
            {metaCapabilities.slice(0, 4).map((item) => (
              <span key={item.title} className="chip">
                {item.title}
              </span>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="规则编排"
          title="规则场景与节点模型就位"
          description="先围绕订单审核和分仓决策做同步规则，避免一开始做成复杂工作流。"
        >
          <div className="chip-row">
            {ruleScenes.slice(0, 4).map((scene) => (
              <span key={scene.scene} className="chip">
                {scene.scene}
              </span>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="two-col-grid">
        <SectionCard
          eyebrow="下一步"
          title="建议按这四步继续"
          description="骨架已经有了，接下来应该尽快把数据和接口层接起来。"
        >
          <ol className="bullet-list">
            {checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard
          eyebrow="目录入口"
          title="当前模块页面"
          description="这些页面现在是结构化占位页，后续可逐步替换为真实业务实现。"
        >
          <ul className="bullet-list">
            <li>
              <span className="bullet-title">
                <Link href="/orders">/orders</Link>
              </span>
              <span className="muted">订单后台状态、操作和异常处理入口。</span>
            </li>
            <li>
              <span className="bullet-title">
                <Link href="/meta">/meta</Link>
              </span>
              <span className="muted">实体、字段、页面和发布治理入口。</span>
            </li>
            <li>
              <span className="bullet-title">
                <Link href="/rules">/rules</Link>
              </span>
              <span className="muted">规则场景、节点和版本管理入口。</span>
            </li>
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
