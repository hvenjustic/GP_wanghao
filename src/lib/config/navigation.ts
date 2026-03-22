import type { PermissionCode } from "@/lib/auth/types";

type NavigationItem = {
  href: string;
  label: string;
  description: string;
  permission: PermissionCode;
};

export const navigationItems: NavigationItem[] = [
  {
    href: "/",
    label: "项目总览",
    description: "查看初始化状态、模块边界和下一步建议。",
    permission: "dashboard:view"
  },
  {
    href: "/orders",
    label: "订单后台",
    description: "聚焦订单状态模型、操作约束和异常处理。",
    permission: "orders:view"
  },
  {
    href: "/users",
    label: "用户权限",
    description: "管理用户状态、角色分配和权限边界。",
    permission: "users:view"
  },
  {
    href: "/audit-logs",
    label: "审计日志",
    description: "追查认证、权限治理和订单关键动作。",
    permission: "users:view"
  },
  {
    href: "/meta",
    label: "低代码配置",
    description: "说明字段、页面、动作和发布治理能力。",
    permission: "meta:view"
  },
  {
    href: "/rules",
    label: "规则编排",
    description: "设计规则画布、治理版本并执行试运行。",
    permission: "rules:view"
  },
  {
    href: "/rule-logs",
    label: "规则日志",
    description: "查看规则版本命中结果、输入输出和耗时。",
    permission: "rules:view"
  }
];
