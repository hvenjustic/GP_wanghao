import { OrderStatus, Prisma } from "@prisma/client";
import type { OrderStatusCode } from "@/features/orders/config/order-states";
import {
  getInitialOrderRecords,
  mockWarehouseCatalog,
  type OrderAmountSummary,
  type OrderLogEntry,
  type OrderReceiver,
  type OrderRecord,
  type OrderRuleHit
} from "@/features/orders/data/mock-orders";
import { prisma } from "@/lib/db/prisma";
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
  | "unlock-order"
  | "mark-abnormal"
  | "clear-abnormal";

export type BatchOrderActionCode = Extract<
  OrderActionCode,
  "approve-review" | "lock-order" | "unlock-order" | "ship-order"
>;

type SearchParamMap = Record<string, string | string[] | undefined>;

type PerformOrderActionInput = {
  orderId: string;
  action: OrderActionCode;
  session: AuthSession;
  payload?: {
    warehouseCode?: string;
    trackingNo?: string;
    trackingPrefix?: string;
    shippingCompany?: string;
    reason?: string;
  };
};

type PerformBulkOrderActionInput = {
  orderIds: string[];
  action: BatchOrderActionCode;
  session: AuthSession;
  payload?: PerformOrderActionInput["payload"];
};

type ActionApplyResult =
  | {
      ok: true;
      message: string;
      nextRecord: OrderRecord;
      newLog: OrderLogEntry;
    }
  | {
      ok: false;
      message: string;
    };

type OrderStoreState = {
  orders: OrderRecord[];
};

type OrderExtensionShape = {
  tags?: string[];
  paymentStatus?: string;
  receiver?: Partial<OrderReceiver>;
  amountSummary?: Partial<OrderAmountSummary>;
  notes?: Partial<OrderRecord["notes"]>;
  ruleHits?: OrderRuleHit[];
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

function formatNow() {
  return formatDateTime(new Date());
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function cloneOrder<T>(value: T): T {
  return structuredClone(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseOrderExtension(value: Prisma.JsonValue | null | undefined): OrderExtensionShape {
  if (!isRecord(value)) {
    return {};
  }

  const tags = Array.isArray(value.tags)
    ? value.tags.filter((item): item is string => typeof item === "string")
    : [];
  const receiver = isRecord(value.receiver) ? value.receiver : {};
  const amountSummary = isRecord(value.amountSummary) ? value.amountSummary : {};
  const notes = isRecord(value.notes) ? value.notes : {};
  const ruleHits = Array.isArray(value.ruleHits)
    ? value.ruleHits.reduce<OrderRuleHit[]>((accumulator, item) => {
        if (!isRecord(item)) {
          return accumulator;
        }

        accumulator.push({
          id: typeof item.id === "string" ? item.id : `rule-hit-${Math.random()}`,
          ruleName: typeof item.ruleName === "string" ? item.ruleName : "未命名规则",
          version: typeof item.version === "string" ? item.version : "v1.0",
          path: typeof item.path === "string" ? item.path : "-",
          result: typeof item.result === "string" ? item.result : "-",
          executedAt:
            typeof item.executedAt === "string" ? item.executedAt : formatNow()
        });

        return accumulator;
      }, [])
    : [];

  return {
    tags,
    paymentStatus:
      typeof value.paymentStatus === "string" ? value.paymentStatus : undefined,
    receiver,
    amountSummary,
    notes,
    ruleHits
  };
}

function buildOrderExtension(record: OrderRecord): Prisma.InputJsonObject {
  return {
    tags: record.tags,
    paymentStatus: record.paymentStatus,
    receiver: record.receiver,
    amountSummary: record.amountSummary,
    notes: record.notes,
    ruleHits: record.ruleHits
  };
}

function resolveWarehouseByCode(code?: string | null) {
  if (!code) {
    return null;
  }

  return mockWarehouseCatalog.find((item) => item.code === code) ?? null;
}

function createManualLogEntry(
  orderId: string,
  operator: string,
  title: string,
  detail: string
): OrderLogEntry {
  return {
    id: `log-${orderId}-${Date.now()}`,
    type: "MANUAL",
    title,
    detail,
    operator,
    createdAt: formatNow()
  };
}

function appendTag(record: OrderRecord, tag: string) {
  if (!record.tags.includes(tag)) {
    record.tags.push(tag);
  }
}

function removeTag(record: OrderRecord, tag: string) {
  record.tags = record.tags.filter((item) => item !== tag);
}

function getRequiredPermissionForAction(action: OrderActionCode): PermissionCode {
  switch (action) {
    case "approve-review":
    case "reject-review":
    case "lock-order":
    case "unlock-order":
    case "mark-abnormal":
    case "clear-abnormal":
      return "orders:review";
    case "assign-warehouse":
      return "orders:assign-warehouse";
    case "ship-order":
      return "orders:ship";
  }
}

function isPrismaOrderDataEnabled() {
  return process.env.ORDER_DATA_SOURCE === "prisma";
}

async function fetchPrismaOrderListRaw(where: Prisma.OrderWhereInput) {
  return prisma.order.findMany({
    where,
    include: {
      customer: true,
      warehouse: true,
      shipments: {
        orderBy: {
          createdAt: "desc"
        },
        take: 1
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

async function fetchPrismaOrderDetailRaw(orderId: string) {
  return prisma.order.findUnique({
    where: {
      id: orderId
    },
    include: {
      customer: true,
      warehouse: true,
      items: true,
      shipments: {
        orderBy: {
          createdAt: "desc"
        }
      },
      operationLogs: {
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });
}

type PrismaOrderListPayload = Awaited<ReturnType<typeof fetchPrismaOrderListRaw>>[number];
type PrismaOrderDetailPayload = NonNullable<
  Awaited<ReturnType<typeof fetchPrismaOrderDetailRaw>>
>;

function createFallbackDataSourceLabel() {
  return "内存演示数据（Prisma 未连接，已回退）";
}

function toOrderStatusEnum(status: OrderStatusCode) {
  return status as unknown as OrderStatus;
}

function mapPrismaOrderToRecord(order: PrismaOrderDetailPayload): OrderRecord {
  const extension = parseOrderExtension(order.extension);
  const latestShipment = order.shipments[0] ?? null;

  return {
    id: order.id,
    orderNo: order.orderNo,
    sourceNo: order.sourceNo ?? "",
    sourceChannel: order.sourceChannel ?? "未知来源",
    customerName:
      order.customer?.name ??
      (typeof extension.receiver?.receiverName === "string"
        ? extension.receiver.receiverName
        : "未命名客户"),
    phone:
      order.customer?.phone ??
      (typeof extension.receiver?.phone === "string" ? extension.receiver.phone : ""),
    customerLevel: order.customer?.level ?? "未分级",
    paymentStatus: extension.paymentStatus ?? "已支付",
    reviewMode: order.reviewMode ?? "待审核",
    status: order.status as OrderStatusCode,
    warehouseCode: order.warehouse?.code ?? null,
    warehouseName: order.warehouse?.name ?? null,
    amount: Number(order.amount),
    tags: extension.tags ?? [],
    createdAt: formatDateTime(order.createdAt),
    isAbnormal: order.isAbnormal,
    isLocked: order.isLocked,
    receiver: {
      receiverName:
        typeof extension.receiver?.receiverName === "string"
          ? extension.receiver.receiverName
          : order.customer?.name ?? "未填写",
      phone:
        typeof extension.receiver?.phone === "string"
          ? extension.receiver.phone
          : order.customer?.phone ?? "",
      province:
        typeof extension.receiver?.province === "string"
          ? extension.receiver.province
          : "",
      city:
        typeof extension.receiver?.city === "string" ? extension.receiver.city : "",
      district:
        typeof extension.receiver?.district === "string"
          ? extension.receiver.district
          : "",
      address:
        typeof extension.receiver?.address === "string"
          ? extension.receiver.address
          : ""
    },
    amountSummary: {
      goodsAmount:
        typeof extension.amountSummary?.goodsAmount === "number"
          ? extension.amountSummary.goodsAmount
          : Number(order.amount),
      discountAmount:
        typeof extension.amountSummary?.discountAmount === "number"
          ? extension.amountSummary.discountAmount
          : 0,
      shippingFee:
        typeof extension.amountSummary?.shippingFee === "number"
          ? extension.amountSummary.shippingFee
          : 0,
      paidAmount:
        typeof extension.amountSummary?.paidAmount === "number"
          ? extension.amountSummary.paidAmount
          : Number(order.amount)
    },
    shipment: latestShipment
      ? {
          companyCode: latestShipment.companyCode,
          companyName: latestShipment.companyName ?? latestShipment.companyCode,
          trackingNo: latestShipment.trackingNo,
          shippedAt: latestShipment.shippedAt
            ? formatDateTime(latestShipment.shippedAt)
            : null
        }
      : null,
    items: order.items.map((item) => ({
      id: item.id,
      skuId: item.skuId,
      skuName: item.skuName,
      spec: item.spec ?? "",
      quantity: item.quantity,
      price: Number(item.price)
    })),
    notes: {
      buyer:
        typeof extension.notes?.buyer === "string" ? extension.notes.buyer : "",
      service:
        typeof extension.notes?.service === "string" ? extension.notes.service : "",
      system:
        typeof extension.notes?.system === "string" ? extension.notes.system : ""
    },
    ruleHits: extension.ruleHits ?? [],
    logs: order.operationLogs.map((log) => ({
      id: log.id,
      type:
        log.type === "SYSTEM" || log.type === "RULE" ? log.type : "MANUAL",
      title: log.title ?? log.action,
      detail: log.detail ?? log.reason ?? "-",
      operator: log.operatorName ?? log.operatorId ?? "未知操作人",
      createdAt: formatDateTime(log.createdAt)
    }))
  };
}

function mapPrismaOrderToListItem(order: PrismaOrderListPayload) {
  const extension = parseOrderExtension(order.extension);

  return {
    id: order.id,
    orderNo: order.orderNo,
    sourceChannel: order.sourceChannel ?? "未知来源",
    customerName:
      order.customer?.name ??
      (typeof extension.receiver?.receiverName === "string"
        ? extension.receiver.receiverName
        : "未命名客户"),
    phone:
      order.customer?.phone ??
      (typeof extension.receiver?.phone === "string" ? extension.receiver.phone : ""),
    status: order.status as OrderStatusCode,
    warehouseName: order.warehouse?.name ?? null,
    amount: Number(order.amount),
    tags: extension.tags ?? [],
    createdAt: formatDateTime(order.createdAt),
    isAbnormal: order.isAbnormal,
    isLocked: order.isLocked
  };
}

function getActionAvailabilityFromPermissions(
  order: Pick<OrderRecord, "status" | "isLocked" | "isAbnormal">,
  permissions: PermissionCode[]
) {
  const canReview = permissions.includes("orders:review");
  const canAssignWarehouse = permissions.includes("orders:assign-warehouse");
  const canShip = permissions.includes("orders:ship");
  const isReviewStage = ["PENDING_REVIEW", "MANUAL_REVIEW"].includes(order.status);
  const isWarehouseStage = ["PENDING_WAREHOUSE", "PENDING_SHIPMENT"].includes(order.status);
  const canMarkAbnormalBase = !["CANCELED", "COMPLETED"].includes(order.status);

  return {
    canApproveReview: canReview && isReviewStage && !order.isLocked,
    canRejectReview: canReview && isReviewStage && !order.isLocked,
    canAssignWarehouse: canAssignWarehouse && isWarehouseStage && !order.isLocked,
    canShip: canShip && order.status === "PENDING_SHIPMENT" && !order.isLocked,
    canLock:
      canReview &&
      !order.isLocked &&
      !["SHIPPED", "CANCELED", "COMPLETED"].includes(order.status),
    canUnlock: canReview && order.isLocked,
    canMarkAbnormal: canReview && canMarkAbnormalBase && !order.isAbnormal,
    canClearAbnormal: canReview && order.isAbnormal
  };
}

function applyOrderActionToRecord(
  record: OrderRecord,
  action: OrderActionCode,
  session: AuthSession,
  payload?: PerformOrderActionInput["payload"]
): ActionApplyResult {
  const requiredPermission = getRequiredPermissionForAction(action);

  if (!hasPermission(session, requiredPermission)) {
    return {
      ok: false,
      message: "当前账号没有执行该操作的权限。"
    };
  }

  const nextRecord = cloneOrder(record);
  const availability = getActionAvailabilityFromPermissions(nextRecord, session.permissions);

  switch (action) {
    case "lock-order": {
      if (!availability.canLock) {
        return {
          ok: false,
          message: "当前订单状态不允许锁单。"
        };
      }

      if (!payload?.reason?.trim()) {
        return {
          ok: false,
          message: "锁单必须填写原因。"
        };
      }

      nextRecord.isLocked = true;
      appendTag(nextRecord, "人工锁单");
      const newLog = createManualLogEntry(
        nextRecord.id,
        session.name,
        "人工锁单",
        payload.reason.trim()
      );
      nextRecord.logs.unshift(newLog);

      return {
        ok: true,
        message: `订单 ${nextRecord.orderNo} 已锁单。`,
        nextRecord,
        newLog
      };
    }

    case "unlock-order": {
      if (!availability.canUnlock) {
        return {
          ok: false,
          message: "当前订单不处于锁单状态。"
        };
      }

      if (!payload?.reason?.trim()) {
        return {
          ok: false,
          message: "解除锁单必须填写原因。"
        };
      }

      nextRecord.isLocked = false;
      removeTag(nextRecord, "人工锁单");
      const newLog = createManualLogEntry(
        nextRecord.id,
        session.name,
        "解除锁单",
        payload.reason.trim()
      );
      nextRecord.logs.unshift(newLog);

      return {
        ok: true,
        message: `订单 ${nextRecord.orderNo} 已解除锁单。`,
        nextRecord,
        newLog
      };
    }

    case "approve-review": {
      if (!availability.canApproveReview) {
        return {
          ok: false,
          message: "当前订单状态不允许审核通过。"
        };
      }

      nextRecord.status = "PENDING_WAREHOUSE";
      nextRecord.reviewMode = "人工审核通过";
      nextRecord.isAbnormal = false;
      removeTag(nextRecord, "人工复核");
      appendTag(nextRecord, "人工放行");
      const newLog = createManualLogEntry(
        nextRecord.id,
        session.name,
        "审核通过",
        payload?.reason?.trim() || "人工确认订单可继续履约，流转到待分仓。"
      );
      nextRecord.logs.unshift(newLog);

      return {
        ok: true,
        message: `订单 ${nextRecord.orderNo} 已审核通过并进入待分仓。`,
        nextRecord,
        newLog
      };
    }

    case "reject-review": {
      if (!availability.canRejectReview) {
        return {
          ok: false,
          message: "当前订单状态不允许审核驳回。"
        };
      }

      if (!payload?.reason?.trim()) {
        return {
          ok: false,
          message: "审核驳回必须填写原因。"
        };
      }

      nextRecord.status = "CANCELED";
      nextRecord.isLocked = false;
      appendTag(nextRecord, "审核驳回");
      const newLog = createManualLogEntry(
        nextRecord.id,
        session.name,
        "审核驳回",
        payload.reason.trim()
      );
      nextRecord.logs.unshift(newLog);

      return {
        ok: true,
        message: `订单 ${nextRecord.orderNo} 已驳回并取消。`,
        nextRecord,
        newLog
      };
    }

    case "assign-warehouse": {
      if (!availability.canAssignWarehouse) {
        return {
          ok: false,
          message: "当前订单状态不允许分仓。"
        };
      }

      const warehouse = resolveWarehouseByCode(payload?.warehouseCode);

      if (!warehouse) {
        return {
          ok: false,
          message: "请选择有效的仓库。"
        };
      }

      if (!payload?.reason?.trim()) {
        return {
          ok: false,
          message: "手工分仓必须填写原因。"
        };
      }

      nextRecord.status = "PENDING_SHIPMENT";
      nextRecord.warehouseCode = warehouse.code;
      nextRecord.warehouseName = warehouse.name;
      const newLog = createManualLogEntry(
        nextRecord.id,
        session.name,
        "手工分仓",
        payload.reason.trim()
      );
      nextRecord.logs.unshift(newLog);

      return {
        ok: true,
        message: `订单 ${nextRecord.orderNo} 已分配到 ${warehouse.name}。`,
        nextRecord,
        newLog
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

      nextRecord.status = "SHIPPED";
      nextRecord.shipment = {
        companyCode: shippingCompany.toUpperCase(),
        companyName: shippingCompany,
        trackingNo,
        shippedAt: formatNow()
      };
      const newLog = createManualLogEntry(
        nextRecord.id,
        session.name,
        "执行发货",
        payload?.reason?.trim() ||
          `录入 ${shippingCompany} 单号 ${trackingNo}，订单进入已发货。`
      );
      nextRecord.logs.unshift(newLog);

      return {
        ok: true,
        message: `订单 ${nextRecord.orderNo} 已发货。`,
        nextRecord,
        newLog
      };
    }

    case "mark-abnormal": {
      if (!availability.canMarkAbnormal) {
        return {
          ok: false,
          message: "当前订单状态不允许标记异常。"
        };
      }

      if (!payload?.reason?.trim()) {
        return {
          ok: false,
          message: "标记异常必须填写原因。"
        };
      }

      nextRecord.isAbnormal = true;
      appendTag(nextRecord, "人工异常");
      const newLog = createManualLogEntry(
        nextRecord.id,
        session.name,
        "标记异常",
        payload.reason.trim()
      );
      nextRecord.logs.unshift(newLog);

      return {
        ok: true,
        message: `订单 ${nextRecord.orderNo} 已标记为异常。`,
        nextRecord,
        newLog
      };
    }

    case "clear-abnormal": {
      if (!availability.canClearAbnormal) {
        return {
          ok: false,
          message: "当前订单不处于异常状态。"
        };
      }

      if (!payload?.reason?.trim()) {
        return {
          ok: false,
          message: "解除异常必须填写原因。"
        };
      }

      nextRecord.isAbnormal = false;
      removeTag(nextRecord, "人工异常");
      const newLog = createManualLogEntry(
        nextRecord.id,
        session.name,
        "解除异常",
        payload.reason.trim()
      );
      nextRecord.logs.unshift(newLog);

      return {
        ok: true,
        message: `订单 ${nextRecord.orderNo} 已解除异常。`,
        nextRecord,
        newLog
      };
    }
  }
}

async function getOrderListFromMemory(filters: OrderListFilters) {
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

async function getOrderDetailFromMemory(orderId: string) {
  const store = getOrderStore();
  const order = store.orders.find((item) => item.id === orderId);
  return order ? cloneOrder(order) : null;
}

async function performOrderActionFromMemory(input: PerformOrderActionInput) {
  const store = getOrderStore();
  const index = store.orders.findIndex((item) => item.id === input.orderId);

  if (index < 0) {
    return {
      ok: false,
      message: "订单不存在。"
    };
  }

  const result = applyOrderActionToRecord(store.orders[index], input.action, input.session, input.payload);

  if (!result.ok) {
    return result;
  }

  store.orders[index] = result.nextRecord;
  return {
    ok: true,
    message: result.message
  };
}

async function getOrderListFromPrisma(filters: OrderListFilters, dataSourceLabel: string) {
  const where: Prisma.OrderWhereInput = {
    ...(filters.status ? { status: toOrderStatusEnum(filters.status) } : {}),
    ...(filters.sourceChannel ? { sourceChannel: filters.sourceChannel } : {}),
    ...(filters.abnormalOnly ? { isAbnormal: true } : {}),
    ...(filters.warehouseName
      ? {
          warehouse: {
            is: {
              name: filters.warehouseName
            }
          }
        }
      : {})
  };

  if (filters.keyword) {
    where.OR = [
      {
        orderNo: {
          contains: filters.keyword,
          mode: "insensitive"
        }
      },
      {
        customer: {
          is: {
            name: {
              contains: filters.keyword,
              mode: "insensitive"
            }
          }
        }
      },
      {
        customer: {
          is: {
            phone: {
              contains: filters.keyword
            }
          }
        }
      }
    ];
  }

  const [orders, sourceChannelRows, warehouseRows] = await Promise.all([
    fetchPrismaOrderListRaw(where),
    prisma.order.findMany({
      select: {
        sourceChannel: true
      },
      distinct: ["sourceChannel"]
    }),
    prisma.warehouse.findMany({
      select: {
        name: true
      },
      orderBy: {
        priority: "desc"
      }
    })
  ]);

  const items = orders.map(mapPrismaOrderToListItem);

  return {
    dataSource: dataSourceLabel,
    items,
    total: items.length,
    sourceOptions: sourceChannelRows
      .map((item) => item.sourceChannel)
      .filter((item): item is string => Boolean(item)),
    warehouseOptions: warehouseRows.map((item) => item.name),
    summary: {
      total: items.length,
      abnormalCount: items.filter((item) => item.isAbnormal).length,
      reviewCount: items.filter((item) =>
        ["PENDING_REVIEW", "MANUAL_REVIEW"].includes(item.status)
      ).length,
      shipmentCount: items.filter((item) => item.status === "PENDING_SHIPMENT").length
    }
  };
}

async function getOrderDetailFromPrisma(orderId: string) {
  const order = await fetchPrismaOrderDetailRaw(orderId);

  return order ? mapPrismaOrderToRecord(order) : null;
}

async function getWarehouseOptionsFromPrisma() {
  const warehouses = await prisma.warehouse.findMany({
    where: {
      status: "ACTIVE"
    },
    select: {
      code: true,
      name: true
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }]
  });

  return warehouses.map((item) => ({
    code: item.code,
    name: item.name
  }));
}

async function performOrderActionFromPrisma(input: PerformOrderActionInput) {
  const currentRecord = await getOrderDetailFromPrisma(input.orderId);

  if (!currentRecord) {
    return {
      ok: false,
      message: "订单不存在。"
    };
  }

  const applyResult = applyOrderActionToRecord(
    currentRecord,
    input.action,
    input.session,
    input.payload
  );

  if (!applyResult.ok) {
    return applyResult;
  }

  const nextRecord = applyResult.nextRecord;

  await prisma.$transaction(async (tx) => {
    const updateData: Prisma.OrderUpdateInput = {
      status: toOrderStatusEnum(nextRecord.status),
      isLocked: nextRecord.isLocked,
      isAbnormal: nextRecord.isAbnormal,
      reviewMode: nextRecord.reviewMode,
      extension: buildOrderExtension(nextRecord)
    };

    if (input.action === "assign-warehouse") {
      const warehouse = nextRecord.warehouseCode
        ? await tx.warehouse.findUnique({
            where: {
              code: nextRecord.warehouseCode
            }
          })
        : null;

      if (!warehouse) {
        throw new Error("目标仓库不存在，无法完成分仓。");
      }

      updateData.warehouse = {
        connect: {
          id: warehouse.id
        }
      };
    }

    await tx.order.update({
      where: {
        id: input.orderId
      },
      data: updateData
    });

    if (input.action === "ship-order" && nextRecord.shipment) {
      await tx.shipment.create({
        data: {
          orderId: input.orderId,
          companyCode: nextRecord.shipment.companyCode,
          companyName: nextRecord.shipment.companyName,
          trackingNo: nextRecord.shipment.trackingNo,
          shippedAt: nextRecord.shipment.shippedAt
            ? new Date(nextRecord.shipment.shippedAt.replace(" ", "T"))
            : null
        }
      });
    }

    await tx.orderOperationLog.create({
      data: {
        orderId: input.orderId,
        operatorId: input.session.userId,
        operatorName: input.session.name,
        type: applyResult.newLog.type,
        action: input.action,
        title: applyResult.newLog.title,
        detail: applyResult.newLog.detail,
        reason: input.payload?.reason?.trim() || null,
        before: {
          status: currentRecord.status,
          isLocked: currentRecord.isLocked,
          isAbnormal: currentRecord.isAbnormal,
          warehouseCode: currentRecord.warehouseCode,
          warehouseName: currentRecord.warehouseName,
          shipment: currentRecord.shipment
        },
        after: {
          status: nextRecord.status,
          isLocked: nextRecord.isLocked,
          isAbnormal: nextRecord.isAbnormal,
          warehouseCode: nextRecord.warehouseCode,
          warehouseName: nextRecord.warehouseName,
          shipment: nextRecord.shipment
        }
      }
    });

    await tx.auditLog.create({
      data: {
        operatorId: input.session.userId,
        action: `ORDER_${input.action.toUpperCase().replaceAll("-", "_")}`,
        targetType: "ORDER",
        targetId: input.orderId,
        detail: {
          orderNo: currentRecord.orderNo,
          before: {
            status: currentRecord.status,
            isLocked: currentRecord.isLocked,
            isAbnormal: currentRecord.isAbnormal,
            warehouseCode: currentRecord.warehouseCode,
            warehouseName: currentRecord.warehouseName,
            shipment: currentRecord.shipment
          },
          after: {
            status: nextRecord.status,
            isLocked: nextRecord.isLocked,
            isAbnormal: nextRecord.isAbnormal,
            warehouseCode: nextRecord.warehouseCode,
            warehouseName: nextRecord.warehouseName,
            shipment: nextRecord.shipment
          },
          reason: input.payload?.reason?.trim() || null
        }
      }
    });
  });

  return {
    ok: true,
    message: applyResult.message
  };
}

async function safeUsePrisma<T>(
  prismaRunner: () => Promise<T>,
  fallbackRunner: () => Promise<T>
) {
  if (!isPrismaOrderDataEnabled()) {
    return fallbackRunner();
  }

  try {
    return await prismaRunner();
  } catch (error) {
    console.warn("Prisma order data source failed, fallback to memory store.", error);
    return fallbackRunner();
  }
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
  return safeUsePrisma(
    () => getOrderListFromPrisma(filters, "Prisma 数据库"),
    () =>
      isPrismaOrderDataEnabled()
        ? getOrderListFromMemory(filters).then((result) => ({
            ...result,
            dataSource: createFallbackDataSourceLabel()
          }))
        : getOrderListFromMemory(filters)
  );
}

export async function getOrderDetail(orderId: string) {
  return safeUsePrisma(
    () => getOrderDetailFromPrisma(orderId),
    () => getOrderDetailFromMemory(orderId)
  );
}

export async function getWarehouseOptions() {
  return safeUsePrisma(
    () => getWarehouseOptionsFromPrisma(),
    async () =>
      mockWarehouseCatalog.map((item) => ({
        code: item.code,
        name: item.name
      }))
  );
}

export function getOrderActionAvailability(
  order: Pick<OrderRecord, "status" | "isLocked" | "isAbnormal">,
  permissions: PermissionCode[]
) {
  return getActionAvailabilityFromPermissions(order, permissions);
}

export function getOrderAvailableActions(
  order: Pick<OrderRecord, "status" | "isLocked" | "isAbnormal">,
  permissions: PermissionCode[]
) {
  const actions = ["查看详情"];
  const availability = getActionAvailabilityFromPermissions(order, permissions);

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

  if (availability.canMarkAbnormal) {
    actions.push("标记异常");
  }

  if (availability.canClearAbnormal) {
    actions.push("解除异常");
  }

  return actions;
}

export async function performOrderAction(input: PerformOrderActionInput) {
  return safeUsePrisma(
    () => performOrderActionFromPrisma(input),
    () => performOrderActionFromMemory(input)
  );
}

export async function performBulkOrderAction(input: PerformBulkOrderActionInput) {
  const uniqueOrderIds = Array.from(new Set(input.orderIds.filter(Boolean)));

  if (uniqueOrderIds.length === 0) {
    return {
      ok: false,
      message: "请至少选择一条订单。"
    };
  }

  const failures: string[] = [];
  let successCount = 0;

  for (const orderId of uniqueOrderIds) {
    const orderDetail =
      input.action === "ship-order" ? await getOrderDetail(orderId) : null;

    if (input.action === "ship-order" && !orderDetail) {
      failures.push(`${orderId}: 订单不存在。`);
      continue;
    }

    const trackingNo =
      input.action === "ship-order"
        ? `${input.payload?.trackingPrefix?.trim() || "BATCH"}-${orderDetail?.orderNo.slice(-6)}`
        : input.payload?.trackingNo;

    const result = await performOrderAction({
      orderId,
      action: input.action,
      session: input.session,
      payload: {
        ...input.payload,
        trackingNo
      }
    });

    if (result.ok) {
      successCount += 1;
      continue;
    }

    failures.push(`${orderId}: ${result.message}`);
  }

  const failedCount = failures.length;
  const summary = `共 ${uniqueOrderIds.length} 条，成功 ${successCount} 条，失败 ${failedCount} 条。`;

  if (successCount === 0) {
    return {
      ok: false,
      message: `批量处理失败。${summary} ${failures.slice(0, 3).join(" ")}`
    };
  }

  if (failedCount > 0) {
    return {
      ok: true,
      message: `批量处理部分成功。${summary} ${failures.slice(0, 3).join(" ")}`
    };
  }

  return {
    ok: true,
    message: `批量处理完成。${summary}`
  };
}
