import { NextRequest, NextResponse } from "next/server";
import { hasPermission } from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
import { buildOrderImportTemplateCsv } from "@/server/services/order-import-service";

function formatNowForFileName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

export async function GET(request: NextRequest) {
  const session = await getAuthSession();

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  if (!hasPermission(session, "orders:review")) {
    return NextResponse.redirect(new URL("/forbidden?required=orders:review", request.url), {
      status: 303
    });
  }

  const fileName = `order-import-template-${formatNowForFileName()}.csv`;

  return new NextResponse(buildOrderImportTemplateCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store"
    }
  });
}
