import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { hasPermission } from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
import { performUserManagementAction } from "@/server/services/user-service";

type RouteParams = Promise<{
  id: string;
}>;

function getSingleFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function POST(
  request: NextRequest,
  context: {
    params: RouteParams;
  }
) {
  const session = await getAuthSession();
  const { id } = await context.params;

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

  const formData = await request.formData();
  const action = getSingleFormValue(formData, "action");
  const redirectTo = "/users";

  if (action !== "set-status" && action !== "set-role") {
    const invalidUrl = new URL(redirectTo, request.url);
    invalidUrl.searchParams.set("error", "不支持的用户管理操作。");
    return NextResponse.redirect(invalidUrl, { status: 303 });
  }

  const result = await performUserManagementAction({
    targetUserId: id,
    action,
    session,
    payload: {
      status: getSingleFormValue(formData, "status") as "ACTIVE" | "DISABLED" | undefined,
      roleCode: getSingleFormValue(formData, "roleCode") as
        | "ADMIN"
        | "OPERATOR"
        | "AUDITOR"
        | "CONFIGURATOR"
        | undefined
    }
  });

  revalidatePath("/users");

  const targetUrl = new URL(redirectTo, request.url);
  targetUrl.searchParams.set(result.ok ? "notice" : "error", result.message);

  return NextResponse.redirect(targetUrl, { status: 303 });
}
