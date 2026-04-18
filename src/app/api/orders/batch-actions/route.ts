import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { hasPermission } from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
import {
  performBulkOrderAction,
  type BatchOrderActionCode
} from "@/server/services/order-service";
import { saveOrderBatchFeedback } from "@/server/services/order-batch-feedback-store";

const batchOrderActionCodes: BatchOrderActionCode[] = [
  "approve-review",
  "lock-order",
  "unlock-order",
  "ship-order"
];

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

  const formData = await request.formData();
  const action = getSingleFormValue(formData, "action") as BatchOrderActionCode;
  const requiredPermission = action === "ship-order" ? "orders:ship" : "orders:review";

  if (!hasPermission(session, requiredPermission)) {
    return NextResponse.redirect(new URL(`/forbidden?required=${requiredPermission}`, request.url), {
      status: 303
    });
  }
  const redirectTo = getSafeRedirectTarget(getSingleFormValue(formData, "redirectTo"));
  const orderIds = formData
    .getAll("orderIds")
    .filter((item): item is string => typeof item === "string");

  if (!batchOrderActionCodes.includes(action)) {
    const invalidUrl = new URL(redirectTo, request.url);
    invalidUrl.searchParams.set("error", "不支持的批量订单操作。");
    return NextResponse.redirect(invalidUrl, { status: 303 });
  }

  const result = await performBulkOrderAction({
    orderIds,
    action,
    session,
    payload: {
      reason: getSingleFormValue(formData, "reason"),
      shippingCompany: getSingleFormValue(formData, "shippingCompany"),
      trackingPrefix: getSingleFormValue(formData, "trackingPrefix")
    }
  });

  revalidatePath("/orders");
  revalidatePath("/rule-logs");
  for (const orderId of orderIds) {
    revalidatePath(`/orders/${orderId}`);
  }

  const targetUrl = new URL(redirectTo, request.url);
  targetUrl.searchParams.set(result.ok ? "notice" : "error", result.message);
  if (result.items.length > 0) {
    const batchFeedbackId = saveOrderBatchFeedback({
      action,
      summary: result.summary,
      items: result.items
    });
    targetUrl.searchParams.set("batchFeedbackId", batchFeedbackId);
  }

  return NextResponse.redirect(targetUrl, { status: 303 });
}
