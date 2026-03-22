import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { permissionCodes, type AuthSession } from "@/lib/auth/types";

export function serializeAuthSession(session: AuthSession) {
  return encodeURIComponent(JSON.stringify(session));
}

export function parseAuthSession(value?: string | null): AuthSession | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<AuthSession>;

    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.roleCode !== "string" ||
      typeof parsed.roleName !== "string" ||
      !Array.isArray(parsed.permissions)
    ) {
      return null;
    }

    const permissions = parsed.permissions.filter((item): item is AuthSession["permissions"][number] =>
      permissionCodes.includes(item as AuthSession["permissions"][number])
    );

    return {
      userId: parsed.userId,
      name: parsed.name,
      email: parsed.email,
      roleCode: parsed.roleCode as AuthSession["roleCode"],
      roleName: parsed.roleName,
      permissions
    };
  } catch {
    return null;
  }
}

export function getAuthCookieOptions() {
  return {
    name: AUTH_COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  };
}
