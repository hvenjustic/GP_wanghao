import type { RoleCode } from "@/lib/auth/types";

type DemoUserDisplay = {
  userId: string;
  name: string;
  email: string;
  roleCode: RoleCode;
  roleName: string;
  passwordHint: string;
};

const demoUsers: DemoUserDisplay[] = [
  {
    userId: "demo-admin",
    name: "系统管理员",
    email: "admin@gp.local",
    roleCode: "ADMIN",
    roleName: "管理员",
    passwordHint: "Admin123!"
  },
  {
    userId: "demo-ops",
    name: "订单运营",
    email: "ops@gp.local",
    roleCode: "OPERATOR",
    roleName: "运营人员",
    passwordHint: "Ops123!"
  },
  {
    userId: "demo-auditor",
    name: "审核专员",
    email: "audit@gp.local",
    roleCode: "AUDITOR",
    roleName: "审核人员",
    passwordHint: "Audit123!"
  },
  {
    userId: "demo-config",
    name: "配置实施",
    email: "config@gp.local",
    roleCode: "CONFIGURATOR",
    roleName: "配置人员",
    passwordHint: "Config123!"
  }
];

export function getDemoUsersForDisplay() {
  return demoUsers;
}
