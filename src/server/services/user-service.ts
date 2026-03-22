import { prisma } from "@/lib/db/prisma";
import {
  hasPermission,
  isRoleCode,
  permissionCodes,
  type AuthSession,
  type PermissionCode,
  type RoleCode
} from "@/lib/auth/types";
import { createAuditLog } from "@/server/services/audit-service";

type UserActionInput = {
  targetUserId: string;
  action: "set-status" | "set-role";
  session: AuthSession;
  payload: {
    status?: "ACTIVE" | "DISABLED";
    roleCode?: RoleCode;
  };
};

function formatDateTime(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function normalizePermissionCodes(values: string[]) {
  return values.filter((item): item is PermissionCode =>
    permissionCodes.includes(item as PermissionCode)
  );
}

export async function getUserManagementOverview() {
  const [users, roles] = await Promise.all([
    prisma.user.findMany({
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
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }]
    }),
    prisma.role.findMany({
      include: {
        users: true,
        permissions: {
          include: {
            permission: true
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    })
  ]);

  const userItems = users.map((user) => {
    const activeRoles = user.roles
      .map((item) => item.role)
      .filter((role) => role.status === "ACTIVE" && isRoleCode(role.code));
    const permissions = normalizePermissionCodes(
      activeRoles.flatMap((role) => role.permissions.map((item) => item.permission.code))
    );
    const primaryRole = activeRoles[0] ?? null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      primaryRoleCode: primaryRole?.code ?? null,
      primaryRoleName: primaryRole?.name ?? "未分配角色",
      permissions,
      permissionCount: permissions.length,
      updatedAt: formatDateTime(user.updatedAt)
    };
  });

  const roleItems = roles.map((role) => ({
    id: role.id,
    code: role.code,
    name: role.name,
    status: role.status,
    userCount: role.users.length,
    permissionCodes: normalizePermissionCodes(
      role.permissions.map((item) => item.permission.code)
    )
  }));

  return {
    users: userItems,
    roles: roleItems,
    summary: {
      totalUsers: userItems.length,
      activeUsers: userItems.filter((item) => item.status === "ACTIVE").length,
      disabledUsers: userItems.filter((item) => item.status !== "ACTIVE").length,
      roleCount: roleItems.length
    }
  };
}

export async function performUserManagementAction(input: UserActionInput) {
  if (!hasPermission(input.session, "users:manage")) {
    return {
      ok: false,
      message: "当前账号没有管理用户权限。"
    };
  }

  const targetUser = await prisma.user.findUnique({
    where: {
      id: input.targetUserId
    },
    include: {
      roles: {
        include: {
          role: true
        }
      }
    }
  });

  if (!targetUser) {
    return {
      ok: false,
      message: "目标用户不存在。"
    };
  }

  if (input.action === "set-status") {
    const status = input.payload.status;

    if (status !== "ACTIVE" && status !== "DISABLED") {
      return {
        ok: false,
        message: "无效的用户状态。"
      };
    }

    if (input.session.userId === targetUser.id && status !== "ACTIVE") {
      return {
        ok: false,
        message: "不能禁用当前登录账号。"
      };
    }

    await prisma.user.update({
      where: {
        id: targetUser.id
      },
      data: {
        status
      }
    });

    await createAuditLog({
      operatorId: input.session.userId,
      action: "USER_STATUS_UPDATED",
      targetType: "USER",
      targetId: targetUser.id,
      detail: {
        email: targetUser.email,
        beforeStatus: targetUser.status,
        afterStatus: status
      }
    });

    return {
      ok: true,
      message: `用户 ${targetUser.name} 已更新为 ${status === "ACTIVE" ? "启用" : "禁用"} 状态。`
    };
  }

  const roleCode = input.payload.roleCode;

  if (!roleCode || !isRoleCode(roleCode)) {
    return {
      ok: false,
      message: "请选择有效角色。"
    };
  }

  if (input.session.userId === targetUser.id) {
    return {
      ok: false,
      message: "不能修改当前登录账号的角色。"
    };
  }

  const role = await prisma.role.findUnique({
    where: {
      code: roleCode
    }
  });

  if (!role || role.status !== "ACTIVE") {
    return {
      ok: false,
      message: "目标角色不存在或未启用。"
    };
  }

  const previousRoles = targetUser.roles.map((item) => item.role.name);

  await prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({
      where: {
        userId: targetUser.id
      }
    });

    await tx.userRole.create({
      data: {
        userId: targetUser.id,
        roleId: role.id
      }
    });
  });

  await createAuditLog({
    operatorId: input.session.userId,
    action: "USER_ROLE_UPDATED",
    targetType: "USER",
    targetId: targetUser.id,
    detail: {
      email: targetUser.email,
      beforeRoles: previousRoles,
      afterRole: role.name
    }
  });

  return {
    ok: true,
    message: `用户 ${targetUser.name} 已调整为 ${role.name}。`
  };
}
