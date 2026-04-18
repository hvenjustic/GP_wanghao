import { Prisma, RuleStatus } from "@prisma/client";
import {
  buildRuleExecutionPath,
  normalizeRuleGraph,
  type RuleGraph,
  type RuleGraphNode,
  type RuleJsonValue
} from "@/features/rules/lib/rule-graph";
import type {
  OrderLogEntry,
  OrderRecord,
  OrderRuleHit
} from "@/features/orders/data/mock-orders";

export type OrderRuleScene = "订单创建后" | "审核通过后" | "发货前校验" | "人工重跑";

type OrderRulePayload = {
  warehouseCode?: string;
  trackingNo?: string;
  shippingCompany?: string;
  reason?: string;
};

type RuntimeAction =
  | {
      action:
        | "lock-order"
        | "unlock-order"
        | "mark-abnormal"
        | "clear-abnormal"
        | "approve-review"
        | "assign-warehouse"
        | "append-tag"
        | "remove-tag"
        | "set-review-mode"
        | "set-note";
      tag?: string;
      note?: string;
      reviewMode?: string;
      warehouseCode?: string;
      stopProcessing?: boolean;
    }
  | {
      action: "noop";
    };

type ActiveRuleVersion = {
  id: string;
  version: number;
  graph: Prisma.JsonValue;
  rule: {
    ruleCode: string;
    name: string;
    type: string;
    scene: string;
    status: RuleStatus;
  };
};

export type OrderRuleExecutionEffect = {
  nextRecord: OrderRecord;
  changed: boolean;
  blockedRequestedAction: boolean;
  messageParts: string[];
  hitItems: OrderRuleHit[];
  logEntries: OrderLogEntry[];
  execLogs: Prisma.RuleExecLogCreateManyInput[];
};

type WarehouseCandidate = {
  code: string;
  name: string;
  region: string | null;
  priority: number;
};

function cloneOrder<T>(value: T): T {
  return structuredClone(value);
}

function formatDateTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function isJsonRecord(value: RuleJsonValue | Prisma.JsonValue | null | undefined): value is Record<string, RuleJsonValue> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function appendTag(record: OrderRecord, tag?: string) {
  if (!tag) {
    return;
  }

  if (!record.tags.includes(tag)) {
    record.tags.push(tag);
  }
}

function removeTag(record: OrderRecord, tag?: string) {
  if (!tag) {
    return;
  }

  record.tags = record.tags.filter((item) => item !== tag);
}

function createRuleLogEntry(orderId: string, title: string, detail: string, createdAt: string): OrderLogEntry {
  return {
    id: `rule-log-${orderId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "RULE",
    title,
    detail,
    operator: "规则引擎",
    createdAt
  };
}

function getPublishTime(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return 0;
  }

  const publishedAt = typeof value.publishedAt === "string" ? value.publishedAt : "";
  if (!publishedAt) {
    return 0;
  }

  const parsed = new Date(publishedAt.includes("T") ? publishedAt : publishedAt.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function deriveDeliveryPriority(record: OrderRecord) {
  if (record.tags.some((tag) => ["加急", "极速发货", "优先履约"].includes(tag))) {
    return "urgent";
  }

  if (
    record.tags.some((tag) => ["VIP", "高价值", "会员优先"].includes(tag)) ||
    record.customerLevel.includes("会员") ||
    record.customerLevel.toUpperCase().includes("VIP")
  ) {
    return "vip";
  }

  return "normal";
}

function getOrderFieldValue(record: OrderRecord, payload: OrderRulePayload | undefined, path: string): unknown {
  const context: Record<string, unknown> = {
    orderNo: record.orderNo,
    sourceNo: record.sourceNo,
    sourceChannel: record.sourceChannel,
    customerName: record.customerName,
    customerLevel: record.customerLevel,
    phone: record.phone,
    amount: record.amount,
    paymentStatus: record.paymentStatus,
    status: record.status,
    reviewMode: record.reviewMode,
    isLocked: record.isLocked,
    isAbnormal: record.isAbnormal,
    tags: record.tags,
    delivery_priority: deriveDeliveryPriority(record),
    warehouseCode: record.warehouseCode,
    warehouseName: record.warehouseName,
    receiver: record.receiver,
    notes: record.notes,
    payload: payload ?? {},
    items: record.items,
    itemCount: record.items.reduce((total, item) => total + item.quantity, 0),
    skuCount: record.items.length
  };

  const segments = path.split(".");
  let current: unknown = context;

  for (const segment of segments) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function evaluateConditionValue(actual: unknown, operator: string, expected: RuleJsonValue | undefined) {
  switch (operator) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "gt":
      return Number(actual) > Number(expected);
    case "gte":
      return Number(actual) >= Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
    case "includes":
      if (Array.isArray(actual)) {
        return actual.includes(expected);
      }
      return String(actual ?? "").includes(String(expected ?? ""));
    case "notIncludes":
      if (Array.isArray(actual)) {
        return !actual.includes(expected);
      }
      return !String(actual ?? "").includes(String(expected ?? ""));
    case "startsWith":
      return String(actual ?? "").startsWith(String(expected ?? ""));
    case "endsWith":
      return String(actual ?? "").endsWith(String(expected ?? ""));
    case "oneOf":
      return Array.isArray(expected) ? expected.includes(actual as never) : false;
    case "exists":
      return actual !== undefined && actual !== null && String(actual).trim() !== "";
    default:
      return false;
  }
}

function inferConditionByLabel(
  ruleCode: string,
  label: string,
  record: OrderRecord,
  payload: OrderRulePayload | undefined
) {
  if (ruleCode === "RULE_ADDRESS_RISK" || label.includes("地址异常")) {
    return (
      !record.receiver.district.trim() ||
      !record.receiver.address.trim() ||
      record.tags.includes("地址待确认") ||
      (record.amount >= 1000 && ["苏州市", "深圳市"].includes(record.receiver.city))
    );
  }

  if (ruleCode === "RULE_AUTO_APPROVE" || label.includes("低风险")) {
    return (
      !record.isLocked &&
      !record.isAbnormal &&
      record.amount <= 300 &&
      record.paymentStatus.includes("已支付")
    );
  }

  if (ruleCode === "RULE_BASE_REVIEW" || label.includes("信息完整")) {
    return Boolean(
      record.receiver.receiverName.trim() &&
        record.receiver.phone.trim() &&
        record.receiver.address.trim()
    );
  }

  if (label.includes("物流") || label.includes("发货前")) {
    return Boolean(payload?.trackingNo?.trim() && payload?.shippingCompany?.trim());
  }

  if (label.includes("区域判断")) {
    return ["PENDING_WAREHOUSE", "PENDING_SHIPMENT"].includes(record.status) && !record.isLocked;
  }

  return true;
}

function parseConditionConfig(config: RuleJsonValue | undefined) {
  if (!isJsonRecord(config)) {
    return null;
  }

  const field = typeof config.field === "string" ? config.field : "";
  const operator = typeof config.operator === "string" ? config.operator : "eq";

  if (!field) {
    return null;
  }

  return {
    field,
    operator,
    value: config.value
  };
}

function parseActionConfig(config: RuleJsonValue | undefined): RuntimeAction[] {
  if (!isJsonRecord(config)) {
    return [];
  }

  const parseSingleAction = (value: RuleJsonValue | undefined): RuntimeAction | null => {
    if (!isJsonRecord(value) || typeof value.action !== "string") {
      return null;
    }

    switch (value.action) {
      case "lock-order":
      case "unlock-order":
      case "mark-abnormal":
      case "clear-abnormal":
      case "approve-review":
      case "assign-warehouse":
      case "append-tag":
      case "remove-tag":
      case "set-review-mode":
      case "set-note":
        return {
          action: value.action,
          ...(typeof value.tag === "string" ? { tag: value.tag } : {}),
          ...(typeof value.note === "string" ? { note: value.note } : {}),
          ...(typeof value.reviewMode === "string"
            ? { reviewMode: value.reviewMode }
            : {}),
          ...(typeof value.warehouseCode === "string"
            ? { warehouseCode: value.warehouseCode }
            : {}),
          ...(typeof value.stopProcessing === "boolean"
            ? { stopProcessing: value.stopProcessing }
            : {})
        };
      default:
        return null;
    }
  };

  if (Array.isArray(config.actions)) {
    return config.actions
      .map((item) => parseSingleAction(item))
      .filter((item): item is RuntimeAction => item !== null);
  }

  const singleAction = parseSingleAction(config);
  return singleAction ? [singleAction] : [];
}

function inferActionsByRule(
  ruleCode: string,
  label: string,
  scene: OrderRuleScene
): RuntimeAction[] {
  if (ruleCode === "RULE_ADDRESS_RISK" || label.includes("锁单")) {
    return [
      {
        action: "lock-order",
        note: "规则命中地址风险，自动锁单并转人工复核。",
        stopProcessing: true
      },
      {
        action: "mark-abnormal"
      },
      {
        action: "append-tag",
        tag: "地址待确认"
      },
      {
        action: "append-tag",
        tag: "人工复核"
      },
      {
        action: "set-review-mode",
        reviewMode: "规则命中地址风险"
      }
    ];
  }

  if (ruleCode === "RULE_AUTO_APPROVE" || label.includes("自动通过")) {
    return [
      {
        action: "approve-review",
        note: "规则自动审核通过，订单进入待分仓。",
        stopProcessing: true
      }
    ];
  }

  if (ruleCode === "RULE_WAREHOUSE_PRIORITY" || label.includes("返回仓库") || label.includes("分仓")) {
    return [
      {
        action: "assign-warehouse",
        note: "规则根据地址区域自动完成分仓。",
        stopProcessing: true
      }
    ];
  }

  if (ruleCode === "RULE_BASE_REVIEW" || label.includes("待审核")) {
    return [
      {
        action: "set-review-mode",
        reviewMode: scene === "订单创建后" ? "规则初审完成" : "规则复核完成"
      },
      {
        action: "set-note",
        note: "规则完成基础审核，订单保持待审核。"
      }
    ];
  }

  return [];
}

function inferResultText(
  resultNode: RuleGraphNode | undefined,
  appliedActions: RuntimeAction[],
  fallbackLabel: string
) {
  if (resultNode?.data.label?.trim()) {
    return resultNode.data.label.trim();
  }

  if (appliedActions.some((item) => item.action === "lock-order")) {
    return "自动锁单并转人工处理";
  }

  if (appliedActions.some((item) => item.action === "assign-warehouse")) {
    return "自动分仓完成";
  }

  if (appliedActions.some((item) => item.action === "approve-review")) {
    return "自动审核通过";
  }

  return fallbackLabel;
}

function isRuleActionTerminal(action: RuntimeAction) {
  return action.action === "lock-order" || action.action === "approve-review" || action.action === "assign-warehouse" || Boolean("stopProcessing" in action && action.stopProcessing);
}

async function resolveWarehouseForRule(
  tx: Prisma.TransactionClient,
  record: OrderRecord,
  preferredCode?: string
) {
  const warehouses = await tx.warehouse.findMany({
    where: {
      status: "ACTIVE"
    },
    select: {
      code: true,
      name: true,
      region: true,
      priority: true
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }]
  });

  const candidates = warehouses as WarehouseCandidate[];

  if (preferredCode) {
    const matched = candidates.find((item) => item.code === preferredCode);
    if (matched) {
      return matched;
    }
  }

  const province = record.receiver.province;

  const eastCandidate = candidates.find((item) => item.code === "WH-EAST-01");
  const southCandidate = candidates.find((item) => item.code === "WH-SOUTH-02");
  const northCandidate = candidates.find((item) => item.code === "WH-NORTH-01");

  if (["浙江省", "江苏省", "上海市", "安徽省"].includes(province) && eastCandidate) {
    return eastCandidate;
  }

  if (["广东省", "广西壮族自治区", "福建省", "海南省"].includes(province) && southCandidate) {
    return southCandidate;
  }

  if (["北京市", "天津市", "河北省", "河南省", "山东省"].includes(province) && northCandidate) {
    return northCandidate;
  }

  return candidates[0] ?? null;
}

async function applyRuntimeAction(
  tx: Prisma.TransactionClient,
  record: OrderRecord,
  action: RuntimeAction,
  scene: OrderRuleScene
) {
  switch (action.action) {
    case "lock-order":
      record.isLocked = true;
      if (scene !== "发货前校验") {
        record.status = "MANUAL_REVIEW";
      }
      appendTag(record, "规则锁单");
      if (action.note) {
        record.notes.system = action.note;
      }
      return;
    case "unlock-order":
      record.isLocked = false;
      removeTag(record, "规则锁单");
      return;
    case "mark-abnormal":
      record.isAbnormal = true;
      appendTag(record, "规则异常");
      return;
    case "clear-abnormal":
      record.isAbnormal = false;
      removeTag(record, "规则异常");
      return;
    case "approve-review":
      if (["PENDING_REVIEW", "MANUAL_REVIEW"].includes(record.status)) {
        record.status = "PENDING_WAREHOUSE";
      }
      record.reviewMode = action.reviewMode ?? "规则自动审核通过";
      record.isLocked = false;
      record.isAbnormal = false;
      removeTag(record, "人工复核");
      appendTag(record, "自动审核通过");
      if (action.note) {
        record.notes.system = action.note;
      }
      return;
    case "assign-warehouse": {
      const warehouse = await resolveWarehouseForRule(tx, record, action.warehouseCode);

      if (!warehouse) {
        return;
      }

      record.warehouseCode = warehouse.code;
      record.warehouseName = warehouse.name;
      record.status = "PENDING_SHIPMENT";
      if (action.note) {
        record.notes.system = `${action.note} 已分配到 ${warehouse.name}。`;
      } else {
        record.notes.system = `规则自动完成分仓，已分配到 ${warehouse.name}。`;
      }
      return;
    }
    case "append-tag":
      appendTag(record, action.tag);
      return;
    case "remove-tag":
      removeTag(record, action.tag);
      return;
    case "set-review-mode":
      if (action.reviewMode) {
        record.reviewMode = action.reviewMode;
      }
      return;
    case "set-note":
      if (action.note) {
        record.notes.system = action.note;
      }
      return;
    case "noop":
      return;
  }
}

async function getActiveRuleVersionsByScene(
  tx: Prisma.TransactionClient,
  scene: OrderRuleScene
): Promise<ActiveRuleVersion[]> {
  const definitions = await tx.ruleDefinition.findMany({
    where: {
      scene,
      status: RuleStatus.PUBLISHED
    },
    include: {
      versions: true
    },
    orderBy: {
      updatedAt: "asc"
    }
  });

  return definitions
    .map((definition) => {
      const versions = [...definition.versions].sort((left, right) => {
        const timeDiff = getPublishTime(right.publishInfo) - getPublishTime(left.publishInfo);
        if (timeDiff !== 0) {
          return timeDiff;
        }

        return right.version - left.version;
      });

      const activeVersion = versions.find((version) => getPublishTime(version.publishInfo) > 0) ?? null;
      return activeVersion
        ? {
            id: activeVersion.id,
            version: activeVersion.version,
            graph: activeVersion.graph,
            rule: {
              ruleCode: definition.ruleCode,
              name: definition.name,
              type: definition.type,
              scene: definition.scene,
              status: definition.status
            }
          }
        : null;
    })
    .filter((item): item is ActiveRuleVersion => item !== null);
}

function buildTraversalNodes(graph: RuleGraph) {
  if (graph.nodes.length === 0) {
    return [] as RuleGraphNode[];
  }

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const outgoing = graph.edges.reduce(
    (map, edge) => {
      const current = map.get(edge.source) ?? [];
      current.push(edge);
      map.set(edge.source, current);
      return map;
    },
    new Map<string, RuleGraph["edges"]>()
  );

  const startNode = graph.nodes.find((node) => node.data.kind === "start") ?? graph.nodes[0];
  const visited = new Set<string>();
  const ordered: RuleGraphNode[] = [];
  let currentNode: RuleGraphNode | undefined = startNode;

  while (currentNode && !visited.has(currentNode.id)) {
    visited.add(currentNode.id);
    ordered.push(currentNode);
    const nextEdge: RuleGraph["edges"][number] | undefined =
      (outgoing.get(currentNode.id) ?? [])[0];
    currentNode = nextEdge ? nodesById.get(nextEdge.target) : undefined;
  }

  return ordered;
}

export async function executeOrderRulesForScene(input: {
  tx: Prisma.TransactionClient;
  order: OrderRecord;
  scene: OrderRuleScene;
  payload?: OrderRulePayload;
  requestedAction?: string;
}) {
  const now = formatDateTime(new Date());
  const activeVersions = await getActiveRuleVersionsByScene(input.tx, input.scene);
  const workingRecord = cloneOrder(input.order);
  const hitItems: OrderRuleHit[] = [];
  const logEntries: OrderLogEntry[] = [];
  const execLogs: Prisma.RuleExecLogCreateManyInput[] = [];
  const messageParts: string[] = [];
  let blockedRequestedAction = false;

  for (const version of activeVersions) {
    const graph = normalizeRuleGraph(version.graph, input.scene);
    const traversalNodes = buildTraversalNodes(graph);
    const pathLabels = buildRuleExecutionPath(graph);
    const beforeRuleState = cloneOrder(workingRecord);
    const appliedActions: RuntimeAction[] = [];
    let matched = true;
    let shouldStopProcessing = false;

    for (const node of traversalNodes) {
      if (node.data.kind === "condition") {
        const conditionConfig = parseConditionConfig(node.data.config);
        const conditionPassed = conditionConfig
          ? evaluateConditionValue(
              getOrderFieldValue(workingRecord, input.payload, conditionConfig.field),
              conditionConfig.operator,
              conditionConfig.value
            )
          : inferConditionByLabel(version.rule.ruleCode, node.data.label, workingRecord, input.payload);

        if (!conditionPassed) {
          matched = false;
          break;
        }
      }

      if (node.data.kind === "action") {
        const configuredActions = parseActionConfig(node.data.config);
        const runtimeActions =
          configuredActions.length > 0
            ? configuredActions
            : inferActionsByRule(version.rule.ruleCode, node.data.label, input.scene);

        for (const runtimeAction of runtimeActions) {
          await applyRuntimeAction(input.tx, workingRecord, runtimeAction, input.scene);
          if (runtimeAction.action !== "noop") {
            appliedActions.push(runtimeAction);
          }
          if (isRuleActionTerminal(runtimeAction)) {
            shouldStopProcessing = true;
          }
        }
      }
    }

    if (!matched) {
      continue;
    }

    if (appliedActions.length === 0 && traversalNodes.every((node) => node.data.kind !== "result")) {
      continue;
    }

    const resultNode = traversalNodes.find((node) => node.data.kind === "result");
    const resultText = inferResultText(
      resultNode,
      appliedActions,
      pathLabels.at(-1) ?? version.rule.name
    );
    const changed = JSON.stringify(beforeRuleState) !== JSON.stringify(workingRecord);
    const blockedByRule =
      input.scene === "发货前校验" &&
      appliedActions.some((action) => action.action === "lock-order" || action.action === "mark-abnormal");

    blockedRequestedAction = blockedRequestedAction || blockedByRule;

    const hitItem: OrderRuleHit = {
      id: `rule-hit-${input.order.id}-${version.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ruleCode: version.rule.ruleCode,
      scene: input.scene,
      ruleName: version.rule.name,
      version: `v${version.version}`,
      path: pathLabels.join(" -> "),
      result: resultText,
      decision:
        appliedActions
          .map((action) => action.action)
          .filter((item) => item !== "noop")
          .join(", ") || "none",
      executedAt: now
    };

    hitItems.push(hitItem);
    logEntries.push(
      createRuleLogEntry(
        input.order.id,
        `${version.rule.name} · ${input.scene}`,
        resultText,
        now
      )
    );
    execLogs.push({
      ruleVersionId: version.id,
      orderId: input.order.id,
      scene: input.scene,
      status: blockedByRule ? "BLOCKED" : "SUCCESS",
      durationMs: 40 + traversalNodes.length * 8 + appliedActions.length * 12,
      input: {
        orderNo: workingRecord.orderNo,
        status: beforeRuleState.status,
        amount: beforeRuleState.amount,
        warehouseCode: beforeRuleState.warehouseCode,
        isLocked: beforeRuleState.isLocked,
        isAbnormal: beforeRuleState.isAbnormal,
        receiverProvince: beforeRuleState.receiver.province,
        receiverCity: beforeRuleState.receiver.city
      },
      result: {
        changed,
        blockedRequestedAction: blockedByRule,
        path: hitItem.path,
        result: resultText,
        actions: appliedActions.map((action) => action.action),
        afterStatus: workingRecord.status,
        afterWarehouseCode: workingRecord.warehouseCode,
        afterIsLocked: workingRecord.isLocked,
        afterIsAbnormal: workingRecord.isAbnormal
      }
    });
    messageParts.push(`${version.rule.name}：${resultText}`);

    if (shouldStopProcessing) {
      break;
    }
  }

  if (hitItems.length > 0) {
    workingRecord.ruleHits = [...hitItems, ...workingRecord.ruleHits].slice(0, 20);
    workingRecord.logs = [...logEntries, ...workingRecord.logs];
  }

  return {
    nextRecord: workingRecord,
    changed: JSON.stringify(input.order) !== JSON.stringify(workingRecord),
    blockedRequestedAction,
    messageParts,
    hitItems,
    logEntries,
    execLogs
  } satisfies OrderRuleExecutionEffect;
}
