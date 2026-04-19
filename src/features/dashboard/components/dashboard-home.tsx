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
          <h1 className="app-header-title">系统总览</h1>
          <p className="app-header-subtitle">
            当前登录账号为 {currentUser.name}，角色是 {currentUser.roleName}。
            你可以从这里进入订单处理、低代码配置、规则编排和日志追踪等核心模块。
          </p>
        </div>
        <div className="app-header-meta">Next.js App Router + PostgreSQL + Prisma</div>
      </header>

      <section className="hero-panel">
        <h2 className="hero-title">围绕订单履约构建统一的配置化业务后台</h2>
        <p className="hero-copy">
          系统以订单管理后台、低代码配置平台和规则编排引擎为核心，
          支持业务处理、字段页面配置、规则决策和日志审计在同一套系统中协同运行。
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
          title="订单处理与履约工作台"
          description="聚焦状态流转、核心动作、异常处理和业务日志追踪。"
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
          title="实体、字段与页面配置"
          description="通过结构化配置管理字段、页面布局、动作和发布版本。"
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
          title="规则设计与执行"
          description="通过可视化画布配置审核、分仓和标签备注等业务规则。"
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
          eyebrow="主体能力"
          title="当前可用能力"
          description="以下能力已经接入系统，可用于业务处理和系统展示。"
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
          description="从这些入口可以进入当前系统的主要业务页面。"
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
