import { NextResponse } from "next/server";

type RedirectStatus = 301 | 302 | 303 | 307 | 308;

const INTERNAL_BASE = "http://internal";

export function createRelativeRedirect(path: string, status: RedirectStatus = 303) {
  return new NextResponse(null, {
    status,
    headers: {
      Location: path
    }
  });
}

export function withQuery(path: string, params: Record<string, string | undefined>) {
  const url = new URL(path, INTERNAL_BASE);

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      url.searchParams.set(key, value);
    }
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
