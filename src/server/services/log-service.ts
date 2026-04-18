import { Prisma } from "@prisma/client";
import {
  buildRuleExplanationSummary,
  buildRuleReasonSummary,
  normalizeRuleNodeExplanations
} from "@/features/rules/lib/rule-explanation";
import { prisma } from "@/lib/db/prisma";

type SearchParamMap = Record<string, string | string[] | undefined>;

export type AuditLogFilters = {
  keyword: string;
  action: string;
  targetType: string;
  startDate: string;
  endDate: string;
};

export type RuleLogFilters = {
  ruleCode: string;
  scene: string;
  status: string;
  orderKeyword: string;
  startDate: string;
  endDate: string;
};

function getSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function formatDateTime(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function parseDateBoundary(value: string, boundary: "start" | "end") {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map((item) => Number(item));

  if (!year || !month || !day) {
    return null;
  }

  return boundary === "start"
    ? new Date(year, month - 1, day, 0, 0, 0, 0)
    : new Date(year, month - 1, day, 23, 59, 59, 999);
}

function buildDateRange(startDate: string, endDate: string) {
  const gte = parseDateBoundary(startDate, "start");
  const lte = parseDateBoundary(endDate, "end");

  if (!gte && !lte) {
    return undefined;
  }

  return {
    ...(gte ? { gte } : {}),
    ...(lte ? { lte } : {})
  } satisfies Prisma.DateTimeFilter;
}

function isJsonRecord(
  value: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined
): value is Prisma.JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function truncateText(value: string, maxLength = 64) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function formatSummaryValue(value: Prisma.JsonValue): string {
  if (Array.isArray(value)) {
    return value
      .slice(0, 3)
      .map((item) => formatSummaryValue(item))
      .join(" / ");
  }

  if (isJsonRecord(value)) {
    return Object.entries(value)
      .slice(0, 2)
      .map(([key, item]) => `${key}=${formatSummaryValue(item ?? null)}`)
      .join(", ");
  }

  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }

  if (value === null) {
    return "空";
  }

  return truncateText(String(value));
}

function summarizeJson(value: Prisma.JsonValue | null | undefined) {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.slice(0, 4).map((item) => formatSummaryValue(item));
  }

  if (isJsonRecord(value)) {
    return Object.entries(value)
      .slice(0, 4)
      .map(([key, item]) => `${key}: ${formatSummaryValue(item ?? null)}`);
  }

  return [formatSummaryValue(value)];
}

function getJsonString(
  value: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined,
  key: string
) {
  if (!isJsonRecord(value)) {
    return "";
  }

  return typeof value[key] === "string" ? value[key] : "";
}

export function normalizeAuditLogFilters(searchParams: SearchParamMap): AuditLogFilters {
  return {
    keyword: getSingleValue(searchParams.keyword).trim(),
    action: getSingleValue(searchParams.action).trim(),
    targetType: getSingleValue(searchParams.targetType).trim(),
    startDate: getSingleValue(searchParams.startDate).trim(),
    endDate: getSingleValue(searchParams.endDate).trim()
  };
}

export function normalizeRuleLogFilters(searchParams: SearchParamMap): RuleLogFilters {
  return {
    ruleCode: getSingleValue(searchParams.ruleCode).trim(),
    scene: getSingleValue(searchParams.scene).trim(),
    status: getSingleValue(searchParams.status).trim(),
    orderKeyword: getSingleValue(searchParams.orderKeyword).trim(),
    startDate: getSingleValue(searchParams.startDate).trim(),
    endDate: getSingleValue(searchParams.endDate).trim()
  };
}

export async function getAuditLogOverview(filters: AuditLogFilters) {
  const conditions: Prisma.AuditLogWhereInput[] = [];
  const createdAt = buildDateRange(filters.startDate, filters.endDate);

  if (filters.action) {
    conditions.push({
      action: filters.action
    });
  }

  if (filters.targetType) {
    conditions.push({
      targetType: filters.targetType
    });
  }

  if (createdAt) {
    conditions.push({
      createdAt
    });
  }

  if (filters.keyword) {
    conditions.push({
      OR: [
        {
          action: {
            contains: filters.keyword,
            mode: "insensitive"
          }
        },
        {
          targetType: {
            contains: filters.keyword,
            mode: "insensitive"
          }
        },
        {
          targetId: {
            contains: filters.keyword,
            mode: "insensitive"
          }
        },
        {
          operator: {
            is: {
              name: {
                contains: filters.keyword,
                mode: "insensitive"
              }
            }
          }
        },
        {
          operator: {
            is: {
              email: {
                contains: filters.keyword,
                mode: "insensitive"
              }
            }
          }
        }
      ]
    });
  }

  const where = conditions.length > 0 ? { AND: conditions } : {};

  const [logs, actionOptions, targetTypeOptions] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        operator: true
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: {
        action: true
      },
      orderBy: {
        action: "asc"
      }
    }),
    prisma.auditLog.findMany({
      distinct: ["targetType"],
      select: {
        targetType: true
      },
      orderBy: {
        targetType: "asc"
      }
    })
  ]);

  const items = logs.map((log) => ({
    id: log.id,
    createdAt: formatDateTime(log.createdAt),
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId ?? "-",
    operatorName: log.operator?.name ?? "系统",
    operatorEmail: log.operator?.email ?? "system",
    detailEntries: summarizeJson(log.detail),
    rawDetail: log.detail ? JSON.stringify(log.detail, null, 2) : ""
  }));

  return {
    items,
    actionOptions: actionOptions.map((item) => item.action),
    targetTypeOptions: targetTypeOptions.map((item) => item.targetType),
    summary: {
      totalLogs: items.length,
      authCount: items.filter((item) =>
        ["USER_LOGIN", "USER_LOGOUT"].includes(item.action)
      ).length,
      orderCount: items.filter((item) => item.targetType === "ORDER").length,
      accessCount: items.filter((item) =>
        ["USER", "ROLE", "PERMISSION"].includes(item.targetType)
      ).length
    }
  };
}

export async function getRuleLogOverview(filters: RuleLogFilters) {
  const conditions: Prisma.RuleExecLogWhereInput[] = [];
  const createdAt = buildDateRange(filters.startDate, filters.endDate);
  let matchedOrderIds: string[] = [];

  if (filters.orderKeyword) {
    const matchedOrders = await prisma.order.findMany({
      where: {
        OR: [
          {
            orderNo: {
              contains: filters.orderKeyword,
              mode: "insensitive"
            }
          },
          {
            sourceNo: {
              contains: filters.orderKeyword,
              mode: "insensitive"
            }
          }
        ]
      },
      select: {
        id: true
      }
    });

    matchedOrderIds = matchedOrders.map((order) => order.id);

    conditions.push({
      OR: [
        {
          orderId: {
            contains: filters.orderKeyword,
            mode: "insensitive"
          }
        },
        ...(matchedOrderIds.length > 0
          ? [
              {
                orderId: {
                  in: matchedOrderIds
                }
              }
            ]
          : [])
      ]
    });
  }

  if (filters.ruleCode) {
    conditions.push({
      ruleVersion: {
        rule: {
          ruleCode: filters.ruleCode
        }
      }
    });
  }

  if (filters.scene) {
    conditions.push({
      scene: filters.scene
    });
  }

  if (filters.status) {
    conditions.push({
      status: filters.status
    });
  }

  if (createdAt) {
    conditions.push({
      createdAt
    });
  }

  const where = conditions.length > 0 ? { AND: conditions } : {};

  const [logs, sceneOptions, statusOptions, ruleOptions] = await Promise.all([
    prisma.ruleExecLog.findMany({
      where,
      include: {
        ruleVersion: {
          include: {
            rule: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.ruleExecLog.findMany({
      distinct: ["scene"],
      select: {
        scene: true
      },
      orderBy: {
        scene: "asc"
      }
    }),
    prisma.ruleExecLog.findMany({
      distinct: ["status"],
      select: {
        status: true
      },
      orderBy: {
        status: "asc"
      }
    }),
    prisma.ruleDefinition.findMany({
      select: {
        ruleCode: true,
        name: true
      },
      orderBy: {
        createdAt: "asc"
      }
    })
  ]);

  const orderIds = logs
    .map((log) => log.orderId)
    .filter((value): value is string => Boolean(value));

  const relatedOrders =
    orderIds.length > 0
      ? await prisma.order.findMany({
          where: {
            id: {
              in: [...new Set(orderIds)]
            }
          },
          select: {
            id: true,
            orderNo: true,
            sourceChannel: true
          }
        })
      : [];

  const orderMap = new Map(relatedOrders.map((order) => [order.id, order]));
  const items = logs.map((log) => {
    const relatedOrder = log.orderId ? orderMap.get(log.orderId) : null;
    const path = getJsonString(log.result, "path");
    const decision = getJsonString(log.result, "decision");
    const resultText = getJsonString(log.result, "result") || getJsonString(log.result, "nextStatus");
    const nodeExplanations = normalizeRuleNodeExplanations(
      isJsonRecord(log.result) ? log.result.nodeExplanations : [],
      path
    );
    const reasonSummary =
      getJsonString(log.result, "reasonSummary") ||
      buildRuleReasonSummary(nodeExplanations, resultText, path);
    const explanationSummary =
      getJsonString(log.result, "explanationSummary") ||
      buildRuleExplanationSummary(nodeExplanations, resultText || "规则执行完成", decision);

    return {
      id: log.id,
      createdAt: formatDateTime(log.createdAt),
      scene: log.scene,
      status: log.status,
      durationMs: log.durationMs,
      ruleCode: log.ruleVersion.rule.ruleCode,
      ruleName: log.ruleVersion.rule.name,
      ruleVersion: `v${log.ruleVersion.version}`,
      orderId: log.orderId ?? "-",
      orderNo: relatedOrder?.orderNo ?? "未关联订单",
      sourceChannel: relatedOrder?.sourceChannel ?? "-",
      path,
      decision,
      reasonSummary,
      explanationSummary,
      nodeExplanations: nodeExplanations.slice(0, 6),
      inputEntries: summarizeJson(log.input),
      resultEntries: summarizeJson(log.result)
    };
  });

  const durationValues = items
    .map((item) => item.durationMs)
    .filter((value): value is number => typeof value === "number");

  return {
    items,
    sceneOptions: sceneOptions.map((item) => item.scene),
    statusOptions: statusOptions.map((item) => item.status),
    ruleOptions,
    summary: {
      totalLogs: items.length,
      successCount: items.filter((item) => item.status === "SUCCESS").length,
      blockedCount: items.filter((item) =>
        ["BLOCKED", "FAILED"].includes(item.status)
      ).length,
      averageDurationMs:
        durationValues.length > 0
          ? Math.round(
              durationValues.reduce((total, value) => total + value, 0) /
                durationValues.length
            )
          : 0
    }
  };
}
