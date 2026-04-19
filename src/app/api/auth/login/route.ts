import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { getAuthCookieOptions, serializeAuthSession } from "@/lib/auth/cookie";
import { createRelativeRedirect, withQuery } from "@/lib/http/redirect";
import { authenticateUser } from "@/server/services/auth-service";
import { createAuditLog } from "@/server/services/audit-service";

function getSafeRedirectTarget(target: string | null) {
  if (!target || !target.startsWith("/") || target.startsWith("//")) {
    return "/";
  }

  return target;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const redirectTo = getSafeRedirectTarget(String(formData.get("redirectTo") ?? "/"));
  const result = await authenticateUser(email, password);

  if (!result.ok) {
    return createRelativeRedirect(
      withQuery("/login", {
        error: result.code,
        redirect: redirectTo !== "/" ? redirectTo : undefined
      }),
      303
    );
  }

  const response = createRelativeRedirect(redirectTo, 303);

  response.cookies.set({
    ...getAuthCookieOptions(),
    name: AUTH_COOKIE_NAME,
    value: serializeAuthSession(result.session)
  });

  await createAuditLog({
    operatorId: result.session.userId,
    action: "AUTH_LOGIN",
    targetType: "AUTH",
    targetId: result.session.userId,
    detail: {
      email: result.session.email,
      roleCode: result.session.roleCode
    }
  });

  return response;
}
