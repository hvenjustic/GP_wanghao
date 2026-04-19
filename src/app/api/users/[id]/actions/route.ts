import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { hasPermission } from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
import { createRelativeRedirect, withQuery } from "@/lib/http/redirect";
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
    return createRelativeRedirect(withQuery("/login", { redirect: "/users" }), 303);
  }

  if (!hasPermission(session, "users:manage")) {
    return createRelativeRedirect(withQuery("/forbidden", { required: "users:manage" }), 303);
  }

  const formData = await request.formData();
  const action = getSingleFormValue(formData, "action");
  const redirectTo = "/users";

  if (action !== "set-status" && action !== "set-role" && action !== "reset-password") {
    return createRelativeRedirect(withQuery(redirectTo, { error: "不支持的用户管理操作。" }), 303);
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
        | undefined,
      newPassword: getSingleFormValue(formData, "newPassword")
    }
  });

  revalidatePath("/users");

  return createRelativeRedirect(
    withQuery(redirectTo, { [result.ok ? "notice" : "error"]: result.message }),
    303
  );
}
