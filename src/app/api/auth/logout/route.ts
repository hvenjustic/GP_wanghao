import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { getAuthCookieOptions } from "@/lib/auth/cookie";
import { createRelativeRedirect } from "@/lib/http/redirect";
import { getAuthSession } from "@/lib/auth/session";
import { createAuditLog } from "@/server/services/audit-service";

export async function POST() {
  const session = await getAuthSession();
  const response = createRelativeRedirect("/login", 303);

  if (session) {
    await createAuditLog({
      operatorId: session.userId,
      action: "AUTH_LOGOUT",
      targetType: "AUTH",
      targetId: session.userId,
      detail: {
        email: session.email,
        roleCode: session.roleCode
      }
    });
  }

  response.cookies.set({
    ...getAuthCookieOptions(),
    name: AUTH_COOKIE_NAME,
    value: "",
    maxAge: 0
  });

  return response;
}
