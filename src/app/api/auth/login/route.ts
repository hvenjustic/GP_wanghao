import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { getAuthCookieOptions, serializeAuthSession } from "@/lib/auth/cookie";
import { authenticateDemoUser } from "@/lib/auth/mock-users";

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
  const session = authenticateDemoUser(email, password);

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "invalid_credentials");

    if (redirectTo !== "/") {
      loginUrl.searchParams.set("redirect", redirectTo);
    }

    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  const response = NextResponse.redirect(new URL(redirectTo, request.url), {
    status: 303
  });

  response.cookies.set({
    ...getAuthCookieOptions(),
    name: AUTH_COOKIE_NAME,
    value: serializeAuthSession(session)
  });

  return response;
}
