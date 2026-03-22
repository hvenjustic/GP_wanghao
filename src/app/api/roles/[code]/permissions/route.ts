import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  hasPermission,
  isRoleCode,
  permissionCodes,
  type PermissionCode
} from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
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
    return NextResponse.redirect(new URL("/login?redirect=/users", request.url), {
      status: 303
    });
  }

  if (!hasPermission(session, "users:manage")) {
    return NextResponse.redirect(new URL("/forbidden?required=users:manage", request.url), {
      status: 303
    });
  }

  if (!isRoleCode(code)) {
    const invalidUrl = new URL("/users", request.url);
    invalidUrl.searchParams.set("error", "无效的角色编码。");
    return NextResponse.redirect(invalidUrl, { status: 303 });
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

  const targetUrl = new URL("/users", request.url);
  targetUrl.searchParams.set(result.ok ? "notice" : "error", result.message);

  return NextResponse.redirect(targetUrl, { status: 303 });
}

function isRolePermissionCode(value: string): value is PermissionCode {
  return permissionCodes.includes(value as PermissionCode);
}
