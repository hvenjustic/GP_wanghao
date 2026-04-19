import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { parseAuthSession } from "@/lib/auth/cookie";
import { createRelativeRedirect, withQuery } from "@/lib/http/redirect";

function isPublicPath(pathname: string) {
  return (
    pathname === "/api/health" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    /\.[^/]+$/.test(pathname)
  );
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = parseAuthSession(request.cookies.get(AUTH_COOKIE_NAME)?.value);

  if (pathname === "/login") {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!session) {
    const redirectTarget = `${pathname}${search}`;
    return createRelativeRedirect(
      redirectTarget !== "/" ? withQuery("/login", { redirect: redirectTarget }) : "/login",
      307
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
