import { NextRequest } from "next/server";
import { hasPermission } from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
import { createRelativeRedirect, withQuery } from "@/lib/http/redirect";
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
    return createRelativeRedirect(withQuery("/login", { redirect: "/orders" }), 303);
  }

  if (!hasPermission(session, "orders:review")) {
    return createRelativeRedirect(withQuery("/forbidden", { required: "orders:review" }), 303);
  }

  const formData = await request.formData();
  const redirectTo = getSafeRedirectTarget(getSingleFormValue(formData, "redirectTo"));
  const file = formData.get("importFile");

  if (!(file instanceof File) || file.size === 0) {
    return createRelativeRedirect(withQuery(redirectTo, { error: "请选择需要校验的 CSV 模板文件。" }), 303);
  }

  if (file.size > 1024 * 1024) {
    return createRelativeRedirect(withQuery(redirectTo, { error: "导入文件不能超过 1MB。" }), 303);
  }

  const csvText = await file.text();
  const result = await validateOrderImportCsv({
    fileName: file.name,
    content: csvText
  });

  const params: Record<string, string | undefined> = {
    [result.ok ? "notice" : "error"]: result.message
  };

  if (result.items.length > 0) {
    const feedbackId = saveOrderImportFeedback({
      summary: result.summary,
      items: result.items
    });
    params.importFeedbackId = feedbackId;
  }

  return createRelativeRedirect(withQuery(redirectTo, params), 303);
}
