import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import {
  performOrderAction,
  type OrderActionCode
} from "@/server/services/order-service";

type RouteParams = Promise<{
  id: string;
}>;

const orderActionCodes: OrderActionCode[] = [
  "approve-review",
  "reject-review",
  "assign-warehouse",
  "ship-order",
  "lock-order",
  "unlock-order"
];

function getSingleFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getSafeRedirectTarget(value: string, orderId: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return `/orders/${orderId}`;
  }

  return value;
}

export async function POST(
  request: NextRequest,
  context: {
    params: RouteParams;
  }
) {
  const { id } = await context.params;
  const session = await getAuthSession();

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", `/orders/${id}`);
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  const formData = await request.formData();
  const action = getSingleFormValue(formData, "action") as OrderActionCode;
  const redirectTo = getSafeRedirectTarget(
    getSingleFormValue(formData, "redirectTo"),
    id
  );

  if (!orderActionCodes.includes(action)) {
    const invalidUrl = new URL(redirectTo, request.url);
    invalidUrl.searchParams.set("error", "不支持的订单操作。");
    return NextResponse.redirect(invalidUrl, { status: 303 });
  }

  const result = await performOrderAction({
    orderId: id,
    action,
    session,
    payload: {
      reason: getSingleFormValue(formData, "reason"),
      warehouseCode: getSingleFormValue(formData, "warehouseCode"),
      trackingNo: getSingleFormValue(formData, "trackingNo"),
      shippingCompany: getSingleFormValue(formData, "shippingCompany")
    }
  });

  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);

  const targetUrl = new URL(redirectTo, request.url);
  targetUrl.searchParams.set(result.ok ? "notice" : "error", result.message);

  return NextResponse.redirect(targetUrl, { status: 303 });
}
