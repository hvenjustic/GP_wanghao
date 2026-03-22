export function getDashboardMetrics() {
  return [
    {
      label: "项目阶段",
      value: "P0 推进中",
      hint: "真实数据库、登录权限和订单状态流转主线已经开始落地。"
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
      value: "PostgreSQL + Prisma",
      hint: "远程数据库已完成建表和种子数据初始化。"
    }
  ];
}

export function getBootstrapChecklist() {
  return [
    "继续把登录权限从数据库会话扩展到按钮权限和接口鉴权。",
    "把订单列表、详情和状态流转全部切到数据库读写并完成联调。",
    "补齐订单驳回、锁单、改仓等高风险动作的表单和审计要求。",
    "在订单主线稳定后，再推进低代码配置发布和规则试运行能力。"
  ];
}
