import { redirect } from "next/navigation";
import { hasPermission, type PermissionCode } from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";

function createLoginTarget(pathname?: string) {
  if (!pathname || pathname === "/") {
    return "/login";
  }

  return `/login?redirect=${encodeURIComponent(pathname)}`;
}

export async function requireAuth(pathname?: string) {
  const session = await getAuthSession();

  if (!session) {
    redirect(createLoginTarget(pathname));
  }

  return session;
}

export async function requirePermission(permission: PermissionCode, pathname?: string) {
  const session = await requireAuth(pathname);

  if (!hasPermission(session, permission)) {
    redirect(`/forbidden?required=${encodeURIComponent(permission)}`);
  }

  return session;
}
