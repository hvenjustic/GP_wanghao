export function getDashboardMetrics() {
  return [
    {
      label: "项目形态",
      value: "单仓 MVP",
      hint: "当前骨架已经具备页面入口、配置层目录和 Prisma Schema。"
    },
    {
      label: "核心模块",
      value: "3 大模块",
      hint: "订单后台、低代码配置、规则编排三块已经分目录初始化。"
    },
    {
      label: "运行接口",
      value: "/api/health",
      hint: "已提供基础健康检查接口，便于部署后联通性验证。"
    },
    {
      label: "数据库层",
      value: "Prisma",
      hint: "基础 schema 已落地，可直接继续迁移和补充业务模型。"
    }
  ];
}

export function getBootstrapChecklist() {
  return [
    "补充 PostgreSQL 连接参数并配置本地 .env。",
    "执行 pnpm install 安装依赖后，运行 pnpm dev 启动开发环境。",
    "根据需求文档继续细化订单状态流转、配置发布和规则试运行接口。",
    "围绕 Prisma Schema 创建首批迁移并开始接入真实数据。"
  ];
}
