import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import {
  hasPermission,
  isRoleCode,
  permissionCodes,
  type PermissionCode
} from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
import { createRelativeRedirect, withQuery } from "@/lib/http/redirect";
import { updateRolePermissions } from "@/server/services/user-service";

type RouteParams = Promise<{
  code: string;
}>;

export async function POST(
  request: NextRequest,
  context: {
    params: RouteParams;
  }
) {
  const session = await getAuthSession();
  const { code } = await context.params;

  if (!session) {
    return createRelativeRedirect(withQuery("/login", { redirect: "/users" }), 303);
  }

  if (!hasPermission(session, "users:manage")) {
    return createRelativeRedirect(withQuery("/forbidden", { required: "users:manage" }), 303);
  }

  if (!isRoleCode(code)) {
    return createRelativeRedirect(withQuery("/users#role-matrix", { error: "无效的角色编码。" }), 303);
  }

  const formData = await request.formData();
  const selectedPermissions = formData
    .getAll("permissionCodes")
    .filter((item): item is string => typeof item === "string");

  const result = await updateRolePermissions({
    roleCode: code,
    permissionCodes: selectedPermissions.filter(isRolePermissionCode),
    session
  });

  revalidatePath("/users");

  return createRelativeRedirect(
    withQuery("/users#role-matrix", { [result.ok ? "notice" : "error"]: result.message }),
    303
  );
}

function isRolePermissionCode(value: string): value is PermissionCode {
  return permissionCodes.includes(value as PermissionCode);
}
