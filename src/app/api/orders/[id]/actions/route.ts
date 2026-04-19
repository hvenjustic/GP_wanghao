import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { createRelativeRedirect, withQuery } from "@/lib/http/redirect";
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
  "unlock-order",
  "mark-abnormal",
  "clear-abnormal"
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
    return createRelativeRedirect(withQuery("/login", { redirect: `/orders/${id}` }), 303);
  }

  const formData = await request.formData();
  const action = getSingleFormValue(formData, "action") as OrderActionCode;
  const redirectTo = getSafeRedirectTarget(
    getSingleFormValue(formData, "redirectTo"),
    id
  );

  if (!orderActionCodes.includes(action)) {
    return createRelativeRedirect(withQuery(redirectTo, { error: "不支持的订单操作。" }), 303);
  }

  const result = await performOrderAction({
    orderId: id,
    action,
    session,
    payload: {
      reason: getSingleFormValue(formData, "reason"),
      warehouseCode: getSingleFormValue(formData, "warehouseCode"),
      trackingNo: getSingleFormValue(formData, "trackingNo"),
      trackingPrefix: getSingleFormValue(formData, "trackingPrefix"),
      shippingCompany: getSingleFormValue(formData, "shippingCompany")
    }
  });

  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/rule-logs");

  return createRelativeRedirect(
    withQuery(redirectTo, { [result.ok ? "notice" : "error"]: result.message }),
    303
  );
}
