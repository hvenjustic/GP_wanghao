export const permissionCodes = [
  "dashboard:view",
  "orders:view",
  "orders:review",
  "orders:assign-warehouse",
  "orders:ship",
  "meta:view",
  "meta:manage",
  "rules:view",
  "rules:manage"
] as const;

export type PermissionCode = (typeof permissionCodes)[number];

export type RoleCode = "ADMIN" | "OPERATOR" | "AUDITOR" | "CONFIGURATOR";

export type AuthSession = {
  userId: string;
  name: string;
  email: string;
  roleCode: RoleCode;
  roleName: string;
  permissions: PermissionCode[];
};

export type DemoUser = AuthSession & {
  password: string;
};

export function hasPermission(
  session: Pick<AuthSession, "permissions"> | null | undefined,
  permission: PermissionCode
) {
  return session?.permissions.includes(permission) ?? false;
}
