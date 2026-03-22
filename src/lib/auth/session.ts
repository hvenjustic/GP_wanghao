import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { parseAuthSession } from "@/lib/auth/cookie";
import { getAuthSessionByUserId } from "@/server/services/auth-service";

export async function getAuthSession() {
  const cookieStore = await cookies();
  const session = parseAuthSession(cookieStore.get(AUTH_COOKIE_NAME)?.value);

  if (!session) {
    return null;
  }

  return getAuthSessionByUserId(session.userId);
}
