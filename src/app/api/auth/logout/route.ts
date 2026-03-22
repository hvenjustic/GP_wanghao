import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { getAuthCookieOptions } from "@/lib/auth/cookie";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), {
    status: 303
  });

  response.cookies.set({
    ...getAuthCookieOptions(),
    name: AUTH_COOKIE_NAME,
    value: "",
    maxAge: 0
  });

  return response;
}
