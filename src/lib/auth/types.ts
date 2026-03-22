export const permissionCodes = [
  "dashboard:view",
  "orders:view",
  "orders:review",
  "orders:assign-warehouse",
  "orders:ship",
  "users:view",
  "users:manage",
  "meta:view",
  "meta:manage",
  "rules:view",
  "rules:manage"
] as const;

export type PermissionCode = (typeof permissionCodes)[number];

export const roleCodes = ["ADMIN", "OPERATOR", "AUDITOR", "CONFIGURATOR"] as const;

export type RoleCode = (typeof roleCodes)[number];

export type AuthSession = {
  userId: string;
  name: string;
  email: string;
  roleCode: RoleCode;
  roleName: string;
  permissions: PermissionCode[];
};

export function hasPermission(
  session: Pick<AuthSession, "permissions"> | null | undefined,
  permission: PermissionCode
) {
  return session?.permissions.includes(permission) ?? false;
}

export function isRoleCode(value: string): value is RoleCode {
  return roleCodes.includes(value as RoleCode);
}
