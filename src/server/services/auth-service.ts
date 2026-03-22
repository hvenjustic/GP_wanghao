import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import {
  isRoleCode,
  permissionCodes,
  roleCodes,
  type AuthSession,
  type PermissionCode,
  type RoleCode
} from "@/lib/auth/types";

type UserWithRelations = Awaited<ReturnType<typeof getUserByIdRaw>>;

export type AuthFailureCode = "invalid_credentials" | "inactive_user" | "access_denied";

const rolePriority: RoleCode[] = [...roleCodes];

async function getUserByIdRaw(userId: string) {
  return prisma.user.findUnique({
    where: {
      id: userId
    },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      }
    }
  });
}

async function getUserByEmailRaw(email: string) {
  return prisma.user.findUnique({
    where: {
      email
    },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      }
    }
  });
}

function normalizePermissions(user: NonNullable<UserWithRelations>): PermissionCode[] {
  const values = new Set<PermissionCode>();

  for (const userRole of user.roles) {
    if (userRole.role.status !== "ACTIVE") {
      continue;
    }

    for (const rolePermission of userRole.role.permissions) {
      const code = rolePermission.permission.code;

      if (permissionCodes.includes(code as PermissionCode)) {
        values.add(code as PermissionCode);
      }
    }
  }

  return [...values];
}

function resolvePrimaryRole(user: NonNullable<UserWithRelations>) {
  const activeRoles = user.roles
    .map((userRole) => userRole.role)
    .filter((role) => role.status === "ACTIVE" && isRoleCode(role.code));

  if (activeRoles.length === 0) {
    return null;
  }

  activeRoles.sort(
    (left, right) => rolePriority.indexOf(left.code as RoleCode) - rolePriority.indexOf(right.code as RoleCode)
  );

  return activeRoles[0];
}

function toAuthSession(user: NonNullable<UserWithRelations>): AuthSession | null {
  if (user.status !== "ACTIVE") {
    return null;
  }

  const primaryRole = resolvePrimaryRole(user);

  if (!primaryRole) {
    return null;
  }

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    roleCode: primaryRole.code as RoleCode,
    roleName: primaryRole.name,
    permissions: normalizePermissions(user)
  };
}

const getSessionByUserIdCached = cache(async (userId: string) => {
  const user = await getUserByIdRaw(userId);

  if (!user) {
    return null;
  }

  return toAuthSession(user);
});

export async function getAuthSessionByUserId(userId: string) {
  return getSessionByUserIdCached(userId);
}

export async function authenticateUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await getUserByEmailRaw(normalizedEmail);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return {
      ok: false as const,
      code: "invalid_credentials" as AuthFailureCode
    };
  }

  if (user.status !== "ACTIVE") {
    return {
      ok: false as const,
      code: "inactive_user" as AuthFailureCode
    };
  }

  const session = toAuthSession(user);

  if (!session) {
    return {
      ok: false as const,
      code: "access_denied" as AuthFailureCode
    };
  }

  return {
    ok: true as const,
    session
  };
}
