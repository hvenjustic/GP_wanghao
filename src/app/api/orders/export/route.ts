import { NextRequest, NextResponse } from "next/server";
import { orderStateMap } from "@/features/orders/config/order-states";
import { hasPermission } from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
import { createRelativeRedirect, withQuery } from "@/lib/http/redirect";
import { getOrderList, normalizeOrderFilters } from "@/server/services/order-service";

function escapeCsvValue(value: string | number | null | undefined) {
  const normalized = String(value ?? "");
  if (
    normalized.includes(",") ||
    normalized.includes("\"") ||
    normalized.includes("\n")
  ) {
    return `"${normalized.replaceAll("\"", "\"\"")}"`;
  }

  return normalized;
}

function formatNowForFileName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `${year}${month}${day}-${hours}${minutes}`;
}

export async function GET(request: NextRequest) {
  const session = await getAuthSession();

  if (!session) {
    return createRelativeRedirect(
      withQuery("/login", { redirect: request.nextUrl.pathname + request.nextUrl.search }),
      303
    );
  }

  if (!hasPermission(session, "orders:view")) {
    return createRelativeRedirect(withQuery("/forbidden", { required: "orders:view" }), 303);
  }

  const filters = normalizeOrderFilters(
    Object.fromEntries(request.nextUrl.searchParams.entries())
  );
  const orderResult = await getOrderList(filters);
  const headers = [
    "订单号",
    "来源渠道",
    "客户名",
    "手机号",
    "订单状态",
    "仓库",
    "标签",
    "异常标记",
    "锁单标记",
    "金额",
    "创建时间"
  ];

  const rows = orderResult.items.map((item) => [
    item.orderNo,
    item.sourceChannel,
    item.customerName,
    item.phone,
    orderStateMap[item.status].name,
    item.warehouseName ?? "待分配",
    item.tags.join("、"),
    item.isAbnormal ? "是" : "否",
    item.isLocked ? "是" : "否",
    item.amount.toFixed(2),
    item.createdAt
  ]);

  const csvContent = [
    headers.map((item) => escapeCsvValue(item)).join(","),
    ...rows.map((row) => row.map((item) => escapeCsvValue(item)).join(","))
  ].join("\n");

  const fileName = `orders-${formatNowForFileName()}.csv`;

  return new NextResponse(`\uFEFF${csvContent}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store"
    }
  });
}
