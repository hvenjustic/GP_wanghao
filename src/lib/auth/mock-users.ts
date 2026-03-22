import type { AuthSession, DemoUser, PermissionCode } from "@/lib/auth/types";

const adminPermissions: PermissionCode[] = [
  "dashboard:view",
  "orders:view",
  "orders:review",
  "orders:assign-warehouse",
  "orders:ship",
  "meta:view",
  "meta:manage",
  "rules:view",
  "rules:manage"
];

const operatorPermissions: PermissionCode[] = [
  "dashboard:view",
  "orders:view",
  "orders:review",
  "orders:assign-warehouse",
  "orders:ship"
];

const auditorPermissions: PermissionCode[] = [
  "dashboard:view",
  "orders:view",
  "orders:review"
];

const configuratorPermissions: PermissionCode[] = [
  "dashboard:view",
  "meta:view",
  "meta:manage",
  "rules:view",
  "rules:manage"
];

const demoUsers: DemoUser[] = [
  {
    userId: "demo-admin",
    name: "系统管理员",
    email: "admin@gp.local",
    password: "Admin123!",
    roleCode: "ADMIN",
    roleName: "管理员",
    permissions: adminPermissions
  },
  {
    userId: "demo-ops",
    name: "订单运营",
    email: "ops@gp.local",
    password: "Ops123!",
    roleCode: "OPERATOR",
    roleName: "运营人员",
    permissions: operatorPermissions
  },
  {
    userId: "demo-auditor",
    name: "审核专员",
    email: "audit@gp.local",
    password: "Audit123!",
    roleCode: "AUDITOR",
    roleName: "审核人员",
    permissions: auditorPermissions
  },
  {
    userId: "demo-config",
    name: "配置实施",
    email: "config@gp.local",
    password: "Config123!",
    roleCode: "CONFIGURATOR",
    roleName: "配置人员",
    permissions: configuratorPermissions
  }
];

export function authenticateDemoUser(email: string, password: string): AuthSession | null {
  const user = demoUsers.find(
    (item) => item.email === email.trim().toLowerCase() && item.password === password
  );

  if (!user) {
    return null;
  }

  return {
    userId: user.userId,
    name: user.name,
    email: user.email,
    roleCode: user.roleCode,
    roleName: user.roleName,
    permissions: user.permissions
  };
}

export function getDemoUsersForDisplay() {
  return demoUsers.map(({ password, ...user }) => ({
    ...user,
    passwordHint: password
  }));
}
