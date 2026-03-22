import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { hasPermission } from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
import {
  performBulkOrderAction,
  type BatchOrderActionCode
} from "@/server/services/order-service";

const batchOrderActionCodes: BatchOrderActionCode[] = [
  "approve-review",
  "lock-order",
  "unlock-order"
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

  if (!hasPermission(session, "orders:review")) {
    return NextResponse.redirect(new URL("/forbidden?required=orders:review", request.url), {
      status: 303
    });
  }

  const formData = await request.formData();
  const action = getSingleFormValue(formData, "action") as BatchOrderActionCode;
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
      reason: getSingleFormValue(formData, "reason")
    }
  });

  revalidatePath("/orders");
  for (const orderId of orderIds) {
    revalidatePath(`/orders/${orderId}`);
  }

  const targetUrl = new URL(redirectTo, request.url);
  targetUrl.searchParams.set(result.ok ? "notice" : "error", result.message);

  return NextResponse.redirect(targetUrl, { status: 303 });
}
