import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { parseAuthSession } from "@/lib/auth/cookie";

export async function getAuthSession() {
  const cookieStore = await cookies();
  return parseAuthSession(cookieStore.get(AUTH_COOKIE_NAME)?.value);
}
