export function getDashboardMetrics() {
  return [
    {
      label: "核心能力",
      value: "订单 + 低代码 + 规则",
      hint: "围绕订单履约提供业务处理、配置发布和规则决策能力。"
    },
    {
      label: "权限模型",
      value: "用户 / 角色 / 权限",
      hint: "登录、菜单、页面和接口访问控制统一由权限模型管理。"
    },
    {
      label: "运行接口",
      value: "/api/health",
      hint: "已提供基础健康检查接口，便于部署后联通性验证。"
    },
    {
      label: "数据库层",
      value: "PostgreSQL + Prisma",
      hint: "核心业务数据、配置数据和日志数据统一持久化管理。"
    }
  ];
}

export function getBootstrapChecklist() {
  return [
    "用户可登录系统，并按角色访问订单、配置、规则和日志页面。",
    "订单可完成审核、锁单、分仓、发货、取消等核心处理动作。",
    "字段和页面配置可发布生效，并在订单页面中展示扩展信息。",
    "规则可试运行、发布并回写订单处理结果，同时保留执行日志。"
  ];
}
