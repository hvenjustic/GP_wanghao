import type { OrderStatusCode } from "@/features/orders/config/order-states";
import {
  getInitialOrderRecords,
  mockWarehouseCatalog,
  type OrderRecord
} from "@/features/orders/data/mock-orders";
import { hasPermission, type AuthSession, type PermissionCode } from "@/lib/auth/types";

export type OrderListFilters = {
  keyword: string;
  status: OrderStatusCode | "";
  sourceChannel: string;
  warehouseName: string;
  abnormalOnly: boolean;
};

export type OrderActionCode =
  | "approve-review"
  | "reject-review"
  | "assign-warehouse"
  | "ship-order"
  | "lock-order"
  | "unlock-order";

type SearchParamMap = Record<string, string | string[] | undefined>;

type PerformOrderActionInput = {
  orderId: string;
  action: OrderActionCode;
  session: AuthSession;
  payload?: {
    warehouseCode?: string;
    trackingNo?: string;
    shippingCompany?: string;
    reason?: string;
  };
};

type OrderStoreState = {
  orders: OrderRecord[];
};

const globalForOrderStore = globalThis as unknown as {
  orderStore?: OrderStoreState;
};

function getOrderStore() {
  if (!globalForOrderStore.orderStore) {
    globalForOrderStore.orderStore = {
      orders: getInitialOrderRecords()
    };
  }

  return globalForOrderStore.orderStore;
}

function getSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function cloneOrder<T>(value: T): T {
  return structuredClone(value);
}

function formatNow() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function createLogId(orderId: string) {
  return `log-${orderId}-${Date.now()}`;
}

function appendTag(order: OrderRecord, tag: string) {
  if (!order.tags.includes(tag)) {
    order.tags.push(tag);
  }
}

function removeTag(order: OrderRecord, tag: string) {
  order.tags = order.tags.filter((item) => item !== tag);
}

function createManualLog(
  order: OrderRecord,
  title: string,
  detail: string,
  operator: string
) {
  order.logs.unshift({
    id: createLogId(order.id),
    type: "MANUAL",
    title,
    detail,
    operator,
    createdAt: formatNow()
  });
}

export function normalizeOrderFilters(searchParams: SearchParamMap): OrderListFilters {
  return {
    keyword: getSingleValue(searchParams.keyword).trim(),
    status: getSingleValue(searchParams.status) as OrderStatusCode | "",
    sourceChannel: getSingleValue(searchParams.sourceChannel).trim(),
    warehouseName: getSingleValue(searchParams.warehouseName).trim(),
    abnormalOnly: getSingleValue(searchParams.abnormalOnly) === "true"
  };
}

export async function getOrderList(filters: OrderListFilters) {
  const store = getOrderStore();
  const filteredOrders = store.orders.filter((order) => {
    const matchesKeyword =
      !filters.keyword ||
      order.orderNo.toLowerCase().includes(filters.keyword.toLowerCase()) ||
      order.customerName.toLowerCase().includes(filters.keyword.toLowerCase()) ||
      order.phone.includes(filters.keyword);

    const matchesStatus = !filters.status || order.status === filters.status;
    const matchesSource =
      !filters.sourceChannel || order.sourceChannel === filters.sourceChannel;
    const matchesWarehouse =
      !filters.warehouseName || (order.warehouseName ?? "") === filters.warehouseName;
    const matchesAbnormal = !filters.abnormalOnly || order.isAbnormal;

    return (
      matchesKeyword &&
      matchesStatus &&
      matchesSource &&
      matchesWarehouse &&
      matchesAbnormal
    );
  });

  const sourceOptions = Array.from(new Set(store.orders.map((item) => item.sourceChannel)));
  const warehouseOptions = Array.from(
    new Set(
      store.orders
        .map((item) => item.warehouseName)
        .filter((item): item is string => Boolean(item))
    )
  );

  return {
    dataSource: "内存演示数据",
    items: cloneOrder(filteredOrders),
    total: filteredOrders.length,
    sourceOptions,
    warehouseOptions,
    summary: {
      total: filteredOrders.length,
      abnormalCount: filteredOrders.filter((item) => item.isAbnormal).length,
      reviewCount: filteredOrders.filter((item) =>
        ["PENDING_REVIEW", "MANUAL_REVIEW"].includes(item.status)
      ).length,
      shipmentCount: filteredOrders.filter((item) => item.status === "PENDING_SHIPMENT")
        .length
    }
  };
}

export async function getOrderDetail(orderId: string) {
  const store = getOrderStore();
  const order = store.orders.find((item) => item.id === orderId);

  return order ? cloneOrder(order) : null;
}

export function getWarehouseOptions() {
  return mockWarehouseCatalog.map((item) => ({
    code: item.code,
    name: item.name
  }));
}

function getRequiredPermissionForAction(action: OrderActionCode): PermissionCode {
  switch (action) {
    case "approve-review":
    case "reject-review":
    case "lock-order":
    case "unlock-order":
      return "orders:review";
    case "assign-warehouse":
      return "orders:assign-warehouse";
    case "ship-order":
      return "orders:ship";
  }
}

export function getOrderActionAvailability(
  order: Pick<OrderRecord, "status" | "isLocked">,
  permissions: PermissionCode[]
) {
  const canReview = permissions.includes("orders:review");
  const canAssignWarehouse = permissions.includes("orders:assign-warehouse");
  const canShip = permissions.includes("orders:ship");
  const isReviewStage = ["PENDING_REVIEW", "MANUAL_REVIEW"].includes(order.status);

  return {
    canApproveReview: canReview && isReviewStage && !order.isLocked,
    canRejectReview: canReview && isReviewStage && !order.isLocked,
    canAssignWarehouse:
      canAssignWarehouse && order.status === "PENDING_WAREHOUSE" && !order.isLocked,
    canShip: canShip && order.status === "PENDING_SHIPMENT" && !order.isLocked,
    canLock:
      canReview &&
      !order.isLocked &&
      !["SHIPPED", "CANCELED"].includes(order.status),
    canUnlock: canReview && order.isLocked
  };
}

export function getOrderAvailableActions(
  order: Pick<OrderRecord, "status" | "isLocked" | "isAbnormal">,
  permissions: PermissionCode[]
) {
  const actions = ["查看详情"];
  const availability = getOrderActionAvailability(order, permissions);

  if (availability.canApproveReview) {
    actions.push("审核通过");
  }

  if (availability.canRejectReview) {
    actions.push("审核驳回");
  }

  if (availability.canAssignWarehouse) {
    actions.push("分仓");
  }

  if (availability.canShip) {
    actions.push("发货");
  }

  if (availability.canLock) {
    actions.push("锁单");
  }

  if (availability.canUnlock) {
    actions.push("解锁");
  }

  if (permissions.includes("orders:review") && order.isAbnormal) {
    actions.push("处理异常");
  }

  return actions;
}

export async function performOrderAction({
  orderId,
  action,
  session,
  payload
}: PerformOrderActionInput) {
  const store = getOrderStore();
  const order = store.orders.find((item) => item.id === orderId);

  if (!order) {
    return {
      ok: false,
      message: "订单不存在。"
    };
  }

  const requiredPermission = getRequiredPermissionForAction(action);

  if (!hasPermission(session, requiredPermission)) {
    return {
      ok: false,
      message: "当前账号没有执行该操作的权限。"
    };
  }

  const availability = getOrderActionAvailability(order, session.permissions);

  switch (action) {
    case "lock-order": {
      if (!availability.canLock) {
        return {
          ok: false,
          message: "当前订单状态不允许锁单。"
        };
      }

      order.isLocked = true;
      appendTag(order, "人工锁单");
      createManualLog(
        order,
        "人工锁单",
        payload?.reason?.trim() || "运营手工锁定订单，等待进一步处理。",
        session.name
      );

      return {
        ok: true,
        message: `订单 ${order.orderNo} 已锁单。`
      };
    }

    case "unlock-order": {
      if (!availability.canUnlock) {
        return {
          ok: false,
          message: "当前订单不处于锁单状态。"
        };
      }

      order.isLocked = false;
      removeTag(order, "人工锁单");
      createManualLog(
        order,
        "解除锁单",
        payload?.reason?.trim() || "运营解除锁单，恢复后续处理。",
        session.name
      );

      return {
        ok: true,
        message: `订单 ${order.orderNo} 已解除锁单。`
      };
    }

    case "approve-review": {
      if (!availability.canApproveReview) {
        return {
          ok: false,
          message: "当前订单状态不允许审核通过。"
        };
      }

      order.status = "PENDING_WAREHOUSE";
      order.reviewMode = "人工审核通过";
      order.isAbnormal = false;
      removeTag(order, "人工复核");
      appendTag(order, "人工放行");
      createManualLog(
        order,
        "审核通过",
        payload?.reason?.trim() || "人工确认订单可继续履约，流转到待分仓。",
        session.name
      );

      return {
        ok: true,
        message: `订单 ${order.orderNo} 已审核通过并进入待分仓。`
      };
    }

    case "reject-review": {
      if (!availability.canRejectReview) {
        return {
          ok: false,
          message: "当前订单状态不允许审核驳回。"
        };
      }

      order.status = "CANCELED";
      order.isLocked = false;
      appendTag(order, "审核驳回");
      createManualLog(
        order,
        "审核驳回",
        payload?.reason?.trim() || "人工审核后决定取消订单。",
        session.name
      );

      return {
        ok: true,
        message: `订单 ${order.orderNo} 已驳回并取消。`
      };
    }

    case "assign-warehouse": {
      if (!availability.canAssignWarehouse) {
        return {
          ok: false,
          message: "当前订单状态不允许分仓。"
        };
      }

      const warehouse = mockWarehouseCatalog.find(
        (item) => item.code === payload?.warehouseCode
      );

      if (!warehouse) {
        return {
          ok: false,
          message: "请选择有效的仓库。"
        };
      }

      order.status = "PENDING_SHIPMENT";
      order.warehouseCode = warehouse.code;
      order.warehouseName = warehouse.name;
      createManualLog(
        order,
        "手工分仓",
        payload?.reason?.trim() || `订单手工分配到 ${warehouse.name}。`,
        session.name
      );

      return {
        ok: true,
        message: `订单 ${order.orderNo} 已分配到 ${warehouse.name}。`
      };
    }

    case "ship-order": {
      if (!availability.canShip) {
        return {
          ok: false,
          message: "当前订单状态不允许发货。"
        };
      }

      const trackingNo = payload?.trackingNo?.trim();
      const shippingCompany = payload?.shippingCompany?.trim();

      if (!trackingNo || !shippingCompany) {
        return {
          ok: false,
          message: "发货需要填写物流公司和物流单号。"
        };
      }

      order.status = "SHIPPED";
      order.shipment = {
        companyCode: shippingCompany.toUpperCase(),
        companyName: shippingCompany,
        trackingNo,
        shippedAt: formatNow()
      };
      createManualLog(
        order,
        "执行发货",
        payload?.reason?.trim() ||
          `录入 ${shippingCompany} 单号 ${trackingNo}，订单进入已发货。`,
        session.name
      );

      return {
        ok: true,
        message: `订单 ${order.orderNo} 已发货。`
      };
    }
  }
}
