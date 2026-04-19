import { NextRequest, NextResponse } from "next/server";
import { hasPermission } from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
import { createRelativeRedirect, withQuery } from "@/lib/http/redirect";
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
    return createRelativeRedirect(withQuery("/login", { redirect: request.nextUrl.pathname }), 303);
  }

  if (!hasPermission(session, "orders:review")) {
    return createRelativeRedirect(withQuery("/forbidden", { required: "orders:review" }), 303);
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
