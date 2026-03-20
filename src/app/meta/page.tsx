import { SectionCard } from "@/components/ui/section-card";
import { metaCapabilities } from "@/features/meta/config/meta-capabilities";

export default function MetaPage() {
  return (
    <div className="page-grid">
      <header className="app-header">
        <div>
          <h1 className="app-header-title">低代码配置平台</h1>
          <p className="app-header-subtitle">
            初始化阶段先把配置边界固定住，避免项目后续演进成无限制的万能配置平台。
          </p>
        </div>
        <div className="app-header-meta">实体 / 字段 / 页面 / 动作 / 发布治理</div>
      </header>

      <div className="three-col-grid">
        {metaCapabilities.map((item) => (
          <SectionCard
            key={item.title}
            eyebrow="配置能力"
            title={item.title}
            description={item.description}
          >
            <div className="chip-row">
              <span className="chip">结构化 Schema</span>
              <span className="chip">统一字段编码</span>
            </div>
          </SectionCard>
        ))}
      </div>

      <div className="two-col-grid">
        <SectionCard
          eyebrow="治理要求"
          title="配置生命周期"
          description="建议所有配置对象都遵循统一状态机，避免线上配置不可控。"
        >
          <ul className="timeline-list">
            <li>
              <span className="timeline-title">草稿</span>
              可编辑、可预览、不可直接影响线上运行页面。
            </li>
            <li>
              <span className="timeline-title">已发布</span>
              成为当前运行版本，进入依赖分析和回滚保护范围。
            </li>
            <li>
              <span className="timeline-title">已停用</span>
              停止继续生效，但保留历史版本和引用记录。
            </li>
          </ul>
        </SectionCard>

        <SectionCard
          eyebrow="建议目录"
          title="配置模块拆分方式"
          description="目录先按领域拆，不按技术细枝末节拆，后续更容易维护。"
        >
          <pre className="code-block">{`src/features/meta/
  config/
  components/
  schema/
  services/

prisma/
  schema.prisma`}</pre>
        </SectionCard>
      </div>
    </div>
  );
}
