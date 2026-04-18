import { NextRequest, NextResponse } from "next/server";
import { hasPermission } from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
import { saveOrderImportFeedback } from "@/server/services/order-import-feedback-store";
import { validateOrderImportCsv } from "@/server/services/order-import-service";

function getSingleFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getSafeRedirectTarget(value: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/orders";
  }

  return value;
}

export async function POST(request: NextRequest) {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.redirect(new URL("/login?redirect=/orders", request.url), {
      status: 303
    });
  }

  if (!hasPermission(session, "orders:review")) {
    return NextResponse.redirect(new URL("/forbidden?required=orders:review", request.url), {
      status: 303
    });
  }

  const formData = await request.formData();
  const redirectTo = getSafeRedirectTarget(getSingleFormValue(formData, "redirectTo"));
  const file = formData.get("importFile");

  if (!(file instanceof File) || file.size === 0) {
    const invalidUrl = new URL(redirectTo, request.url);
    invalidUrl.searchParams.set("error", "请选择需要校验的 CSV 模板文件。");
    return NextResponse.redirect(invalidUrl, { status: 303 });
  }

  if (file.size > 1024 * 1024) {
    const invalidUrl = new URL(redirectTo, request.url);
    invalidUrl.searchParams.set("error", "导入文件不能超过 1MB。");
    return NextResponse.redirect(invalidUrl, { status: 303 });
  }

  const csvText = await file.text();
  const result = await validateOrderImportCsv({
    fileName: file.name,
    content: csvText
  });

  const targetUrl = new URL(redirectTo, request.url);
  targetUrl.searchParams.set(result.ok ? "notice" : "error", result.message);

  if (result.items.length > 0) {
    const feedbackId = saveOrderImportFeedback({
      summary: result.summary,
      items: result.items
    });
    targetUrl.searchParams.set("importFeedbackId", feedbackId);
  }

  return NextResponse.redirect(targetUrl, { status: 303 });
}
