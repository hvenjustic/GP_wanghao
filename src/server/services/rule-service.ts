import { Prisma, RuleStatus } from "@prisma/client";
import {
  buildRuleGraphIndex,
  createDefaultRuleGraph,
  getLinearNextRuleNode,
  normalizeRuleGraph,
  parseRuleGraphText,
  resolveRuleBranchSelection,
  ruleGraphToText,
  summarizeRuleGraph
} from "@/features/rules/lib/rule-graph";
import {
  buildRuleExplanationSummary,
  buildRuleReasonSummary,
  type RuleNodeExplanation
} from "@/features/rules/lib/rule-explanation";
import {
  describeRuleConditionExpression,
  evaluateRuleConditionExpression,
  parseRuleConditionExpressionConfig
} from "@/features/rules/lib/rule-expression";
import { ruleScenes, ruleTypeOptions } from "@/features/rules/config/rule-scenes";
import { hasPermission, type AuthSession } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import { createAuditLog } from "@/server/services/audit-service";

type ActionResult = {
  ok: boolean;
  message: string;
  ruleId?: string;
  versionId?: string;
};

type RuleSelection = {
  ruleId?: string;
  versionId?: string;
};

type RuleDefinitionActionInput = {
  action: "create" | "update" | "delete" | "enable" | "disable";
  session: AuthSession;
  payload: {
    id?: string;
    ruleCode?: string;
    name?: string;
    type?: string;
    scene?: string;
    reason?: string;
  };
};

type RuleVersionActionInput = {
  action: "save-draft" | "clone-version" | "publish" | "rollback";
  session: AuthSession;
  payload: {
    versionId?: string;
    targetVersion?: number;
    note?: string;
    reason?: string;
    graphText?: string;
  };
};

type RuleTestRunActionInput = {
  session: AuthSession;
  payload: {
    versionId?: string;
    orderId?: string;
    sampleInputText?: string;
  };
};

function formatDateTime(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function isJsonRecord(
  value: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined
): value is Prisma.JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function summarizeJsonEntries(value: Prisma.JsonValue | null | undefined) {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.slice(0, 4).map((item) => summarizeScalar(item));
  }

  if (isJsonRecord(value)) {
    return Object.entries(value)
      .slice(0, 4)
      .map(([key, item]) => `${key}: ${summarizeScalar(item ?? null)}`);
  }

  return [summarizeScalar(value)];
}

function summarizeScalar(value: Prisma.JsonValue): string {
  if (Array.isArray(value)) {
    return value
      .slice(0, 3)
      .map((item) => summarizeScalar(item))
      .join(" / ");
  }

  if (isJsonRecord(value)) {
    return Object.entries(value)
      .slice(0, 2)
      .map(([key, item]) => `${key}=${summarizeScalar(item ?? null)}`)
      .join(", ");
  }

  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }

  if (value === null) {
    return "空";
  }

  return String(value);
}

function parseDateLike(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parsePublishInfo(value: Prisma.JsonValue | null | undefined) {
  if (!isJsonRecord(value)) {
    return null;
  }

  const publishedAtRaw = typeof value.publishedAt === "string" ? value.publishedAt : "";
  const publishedAt = parseDateLike(publishedAtRaw);

  return {
    publishedAt,
    publishedAtText:
      typeof value.publishedAtText === "string"
        ? value.publishedAtText
        : publishedAt
          ? formatDateTime(publishedAt)
          : publishedAtRaw || "-",
    publishedBy: typeof value.publishedBy === "string" ? value.publishedBy : "系统",
    mode: typeof value.mode === "string" ? value.mode : "publish",
    note: typeof value.note === "string" ? value.note : "",
    reason: typeof value.reason === "string" ? value.reason : ""
  };
}

function getActiveVersionId(
  versions: Array<{
    id: string;
    version: number;
    publishInfo: Prisma.JsonValue | null;
  }>
) {
  const activations = versions
    .map((version) => ({
      id: version.id,
      version: version.version,
      publishInfo: parsePublishInfo(version.publishInfo)
    }))
    .filter((item) => item.publishInfo?.publishedAt);

  if (activations.length === 0) {
    return null;
  }

  activations.sort((left, right) => {
    const leftTime = left.publishInfo?.publishedAt?.getTime() ?? 0;
    const rightTime = right.publishInfo?.publishedAt?.getTime() ?? 0;

    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return right.version - left.version;
  });

  return activations[0]?.id ?? null;
}

function getPublishedHistoryCount(
  versions: Array<{
    publishInfo: Prisma.JsonValue | null;
  }>
) {
  return versions.filter((version) => Boolean(parsePublishInfo(version.publishInfo))).length;
}

function validateRuleCode(value: string) {
  return /^[A-Z][A-Z0-9_]{2,47}$/.test(value);
}

function isValidRuleType(value: string) {
  return ruleTypeOptions.includes(value as (typeof ruleTypeOptions)[number]);
}

function isValidRuleScene(value: string) {
  return ruleScenes.some((scene) => scene.scene === value);
}

async function getNextRuleVersionNumber(ruleId: string, preferredVersion?: number) {
  const latestVersion = await prisma.ruleVersion.findFirst({
    where: {
      ruleId
    },
    orderBy: {
      version: "desc"
    },
    select: {
      version: true
    }
  });

  const nextVersion = (latestVersion?.version ?? 0) + 1;

  if (
    typeof preferredVersion === "number" &&
    Number.isInteger(preferredVersion) &&
    preferredVersion >= nextVersion
  ) {
    return preferredVersion;
  }

  return nextVersion;
}

function buildDefaultRuleSampleInput(scene: string, type: string, ruleCode?: string) {
  if (ruleCode === "RULE_AUTO_APPROVE") {
    return JSON.stringify(
      {
        orderNo: "GP202603220003",
        amount: 256,
        paymentStatus: "已支付",
        isLocked: false,
        isAbnormal: false,
        tags: ["自动审核候选"]
      },
      null,
      2
    );
  }

  if (ruleCode === "RULE_WAREHOUSE_PRIORITY" || type === "WAREHOUSE_ASSIGN") {
    return JSON.stringify(
      {
        orderNo: "GP202603220099",
        receiver: {
          province: "浙江省",
          city: "杭州市"
        },
        amount: 268,
        status: "PENDING_WAREHOUSE"
      },
      null,
      2
    );
  }

  if (scene === "发货前校验") {
    return JSON.stringify(
      {
        orderNo: "GP202603220004",
        delivery_priority: "urgent",
        tags: ["加急"],
        payload: {
          shippingCompany: "中通快递",
          trackingNo: "ZT9988776655"
        },
        warehouseCode: "WH-EAST-01"
      },
      null,
      2
    );
  }

  if (ruleCode === "RULE_MANUAL_RETRY_RECHECK" || scene === "人工重跑") {
    return JSON.stringify(
      {
        orderNo: "GP202603220002",
        isAbnormal: true,
        isLocked: true,
        tags: ["地址待确认", "人工复核"],
        reviewMode: "人工审核"
      },
      null,
      2
    );
  }

  return JSON.stringify(
    {
      orderNo: "GP202603220099",
      amount: 268,
      channel: "微信小店",
      tags: ["首单", "高客单"]
    },
    null,
    2
  );
}

function inferDecision(type: string, pathLabels: string[]) {
  const pathText = pathLabels.join(" ");

  if (pathText.includes("锁单") || pathText.includes("拦截")) {
    return {
      decision: "LOCK_ORDER",
      status: "BLOCKED"
    };
  }

  if (pathText.includes("自动通过") || pathText.includes("通过")) {
    return {
      decision: "APPROVED",
      status: "SUCCESS"
    };
  }

  if (pathText.includes("放行") || pathText.includes("通过发货")) {
    return {
      decision: "ALLOW_SHIPMENT",
      status: "SUCCESS"
    };
  }

  if (type === "WAREHOUSE_ASSIGN") {
    return {
      decision: "ASSIGN_WAREHOUSE",
      status: "SUCCESS"
    };
  }

  return {
    decision: "MANUAL_REVIEW",
    status: "SUCCESS"
  };
}

export async function getRuleManagementOverview(selection: RuleSelection = {}) {
  const [definitions, totalRuns] = await Promise.all([
    prisma.ruleDefinition.findMany({
      include: {
        versions: {
          include: {
            _count: {
              select: {
                execLogs: true
              }
            }
          },
          orderBy: {
            version: "desc"
          }
        }
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }]
    }),
    prisma.ruleExecLog.count()
  ]);

  const ruleItems = definitions.map((definition) => {
    const activeVersionId = getActiveVersionId(definition.versions);
    const activeVersion = definition.versions.find((version) => version.id === activeVersionId) ?? null;
    const activePublishInfo = activeVersion ? parsePublishInfo(activeVersion.publishInfo) : null;
    const publishedHistoryCount = getPublishedHistoryCount(definition.versions);

    return {
      id: definition.id,
      ruleCode: definition.ruleCode,
      name: definition.name,
      type: definition.type,
      scene: definition.scene,
      status: definition.status,
      versionCount: definition.versions.length,
      activeVersionId,
      activeVersion: activeVersion?.version ?? null,
      draftCount: definition.versions.filter((version) => !parsePublishInfo(version.publishInfo)).length,
      publishedHistoryCount,
      publishedAt: activePublishInfo?.publishedAtText ?? "-",
      updatedAt: formatDateTime(definition.updatedAt)
    };
  });

  const selectedDefinition =
    definitions.find((definition) => definition.id === selection.ruleId) ??
    definitions.find((definition) => definition.status === RuleStatus.PUBLISHED) ??
    definitions[0] ??
    null;

  const selectedVersionRecords = selectedDefinition ? [...selectedDefinition.versions] : [];
  const selectedActiveVersionId = selectedDefinition
    ? getActiveVersionId(selectedDefinition.versions)
    : null;
  const selectedVersionRecord =
    selectedVersionRecords.find((version) => version.id === selection.versionId) ??
    selectedVersionRecords.find((version) => version.id === selectedActiveVersionId) ??
    selectedVersionRecords[0] ??
    null;

  const [recentRuns] = await Promise.all([
    selectedDefinition
      ? prisma.ruleExecLog.findMany({
          where: {
            ruleVersion: {
              ruleId: selectedDefinition.id
            }
          },
          include: {
            ruleVersion: true
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 8
        })
      : Promise.resolve([])
  ]);

  const versionItems = selectedVersionRecords.map((version) => {
    const graph = normalizeRuleGraph(version.graph, selectedDefinition?.scene);
    const summary = summarizeRuleGraph(graph);
    const publishInfo = parsePublishInfo(version.publishInfo);

    return {
      id: version.id,
      version: version.version,
      nodeCount: summary.nodeCount,
      edgeCount: summary.edgeCount,
      labels: summary.labels,
      pathPreview: summary.pathPreview || "-",
      execCount: version._count.execLogs,
      updatedAt: formatDateTime(version.updatedAt),
      isActive: version.id === selectedActiveVersionId,
      publishedAt: publishInfo?.publishedAtText ?? "-",
      publishedBy: publishInfo?.publishedBy ?? "-",
      publishMode: publishInfo?.mode ?? "draft",
      publishNote: publishInfo?.note || publishInfo?.reason || ""
    };
  });

  const selectedGraph = normalizeRuleGraph(selectedVersionRecord?.graph, selectedDefinition?.scene);
  const selectedGraphSummary = summarizeRuleGraph(selectedGraph);
  const selectedPublishInfo = selectedVersionRecord
    ? parsePublishInfo(selectedVersionRecord.publishInfo)
    : null;

  return {
    summary: {
      totalRules: ruleItems.length,
      publishedRules: ruleItems.filter((item) => item.status === RuleStatus.PUBLISHED).length,
      totalVersions: definitions.reduce((total, definition) => total + definition.versions.length, 0),
      totalRuns
    },
    rules: ruleItems,
    selectedRule: selectedDefinition
      ? {
          id: selectedDefinition.id,
          ruleCode: selectedDefinition.ruleCode,
          name: selectedDefinition.name,
          type: selectedDefinition.type,
          scene: selectedDefinition.scene,
          status: selectedDefinition.status,
          updatedAt: formatDateTime(selectedDefinition.updatedAt),
          activeVersionId: selectedActiveVersionId,
          activeVersion:
            selectedVersionRecords.find((version) => version.id === selectedActiveVersionId)?.version ??
            null,
          publishedHistoryCount: getPublishedHistoryCount(selectedDefinition.versions),
          governanceHint:
            selectedDefinition.status === RuleStatus.DISABLED
              ? "当前规则已停用，不会参与线上自动执行；启用后会恢复到最近一次线上版本或草稿状态。"
              : selectedDefinition.status === RuleStatus.PUBLISHED
                ? "当前规则处于启用状态，线上执行会以最近一次激活版本为准。"
                : "当前规则仍是草稿态，只有发布后才会参与线上执行。"
        }
      : null,
    selectedVersion: selectedVersionRecord
      ? {
          id: selectedVersionRecord.id,
          version: selectedVersionRecord.version,
          isActive: selectedVersionRecord.id === selectedActiveVersionId,
          graphText: ruleGraphToText(selectedGraph),
          nodeCount: selectedGraphSummary.nodeCount,
          edgeCount: selectedGraphSummary.edgeCount,
          pathPreview: selectedGraphSummary.pathPreview || "-",
          publishedAt: selectedPublishInfo?.publishedAtText ?? "-",
          publishedBy: selectedPublishInfo?.publishedBy ?? "-",
          publishMode: selectedPublishInfo?.mode ?? "draft",
          publishNote: selectedPublishInfo?.note || selectedPublishInfo?.reason || ""
        }
      : null,
    versionItems,
    recentRuns: recentRuns.map((log) => ({
      id: log.id,
      versionLabel: `v${log.ruleVersion.version}`,
      status: log.status,
      durationMs: log.durationMs ?? 0,
      orderId: log.orderId ?? "-",
      createdAt: formatDateTime(log.createdAt),
      inputEntries: summarizeJsonEntries(log.input),
      resultEntries: summarizeJsonEntries(log.result)
    })),
    defaultTestInput: selectedDefinition
      ? buildDefaultRuleSampleInput(
          selectedDefinition.scene,
          selectedDefinition.type,
          selectedDefinition.ruleCode
        )
      : buildDefaultRuleSampleInput("订单创建后", "ORDER_REVIEW"),
    options: {
      sceneOptions: ruleScenes.map((scene) => scene.scene),
      typeOptions: [...ruleTypeOptions]
    }
  };
}

export async function performRuleDefinitionAction(
  input: RuleDefinitionActionInput
): Promise<ActionResult> {
  if (!hasPermission(input.session, "rules:manage")) {
    return {
      ok: false,
      message: "当前账号没有管理规则编排的权限。"
    };
  }

  const id = input.payload.id?.trim() ?? "";
  const ruleCode = input.payload.ruleCode?.trim().toUpperCase() ?? "";
  const name = input.payload.name?.trim() ?? "";
  const type = input.payload.type?.trim() ?? "";
  const scene = input.payload.scene?.trim() ?? "";
  const reason = input.payload.reason?.trim() ?? "";

  if (["delete", "enable", "disable"].includes(input.action)) {
    if (!id) {
      return {
        ok: false,
        message:
          input.action === "delete"
            ? "缺少待删除的规则 ID。"
            : "缺少目标规则 ID。"
      };
    }

    const rule = await prisma.ruleDefinition.findUnique({
      where: {
        id
      },
      include: {
        versions: true
      }
    });

    if (!rule) {
      return {
        ok: false,
        message: "目标规则不存在。"
      };
    }

    const activeVersionId = getActiveVersionId(rule.versions);
    const publishedHistoryCount = getPublishedHistoryCount(rule.versions);

    if (input.action === "disable") {
      if (rule.status === RuleStatus.DISABLED) {
        return {
          ok: false,
          message: `规则 ${rule.ruleCode} 当前已停用。`
        };
      }

      if (!reason) {
        return {
          ok: false,
          message: "停用规则时必须填写停用原因。"
        };
      }

      await prisma.ruleDefinition.update({
        where: {
          id: rule.id
        },
        data: {
          status: RuleStatus.DISABLED
        }
      });

      await createAuditLog({
        operatorId: input.session.userId,
        action: "RULE_DEFINITION_DISABLED",
        targetType: "RULE_DEFINITION",
        targetId: rule.id,
        detail: {
          ruleCode: rule.ruleCode,
          previousStatus: rule.status,
          activeVersionId,
          reason
        }
      });

      return {
        ok: true,
        message: `规则 ${rule.ruleCode} 已停用，线上自动执行已关闭。`,
        ruleId: rule.id,
        versionId: activeVersionId ?? undefined
      };
    }

    if (input.action === "enable") {
      if (rule.status !== RuleStatus.DISABLED) {
        return {
          ok: false,
          message: `规则 ${rule.ruleCode} 当前不是停用状态，无需启用。`
        };
      }

      const restoredStatus = activeVersionId ? RuleStatus.PUBLISHED : RuleStatus.DRAFT;

      await prisma.ruleDefinition.update({
        where: {
          id: rule.id
        },
        data: {
          status: restoredStatus
        }
      });

      await createAuditLog({
        operatorId: input.session.userId,
        action: "RULE_DEFINITION_ENABLED",
        targetType: "RULE_DEFINITION",
        targetId: rule.id,
        detail: {
          ruleCode: rule.ruleCode,
          restoredStatus,
          activeVersionId,
          note: reason || null
        }
      });

      return {
        ok: true,
        message:
          restoredStatus === RuleStatus.PUBLISHED
            ? `规则 ${rule.ruleCode} 已启用，并恢复到线上状态。`
            : `规则 ${rule.ruleCode} 已启用，当前恢复为草稿状态。`,
        ruleId: rule.id,
        versionId: activeVersionId ?? rule.versions[0]?.id
      };
    }

    const execCount = await prisma.ruleExecLog.count({
      where: {
        ruleVersion: {
          ruleId: rule.id
        }
      }
    });

    if (rule.status === RuleStatus.PUBLISHED) {
      return {
        ok: false,
        message: `规则 ${rule.ruleCode} 当前仍在线上生效，请先停用后再删除。`
      };
    }

    if (publishedHistoryCount > 0) {
      return {
        ok: false,
        message: `规则 ${rule.ruleCode} 已存在发布历史，不能直接删除。`
      };
    }

    if (execCount > 0) {
      return {
        ok: false,
        message: `规则 ${rule.ruleCode} 已有 ${execCount} 条执行记录，不能直接删除。`
      };
    }

    await prisma.ruleDefinition.delete({
      where: {
        id: rule.id
      }
    });

    await createAuditLog({
      operatorId: input.session.userId,
      action: "RULE_DEFINITION_DELETED",
      targetType: "RULE_DEFINITION",
      targetId: rule.id,
      detail: {
        ruleCode: rule.ruleCode
      }
    });

    return {
      ok: true,
      message: `规则 ${rule.ruleCode} 已删除。`
    };
  }

  if (!ruleCode || !validateRuleCode(ruleCode)) {
    return {
      ok: false,
      message: "规则编码需使用大写字母、数字和下划线，且以字母开头。"
    };
  }

  if (!name || !isValidRuleType(type) || !isValidRuleScene(scene)) {
    return {
      ok: false,
      message: "请完整填写规则名称、规则类型和触发场景。"
    };
  }

  if (input.action === "create") {
    const duplicate = await prisma.ruleDefinition.findUnique({
      where: {
        ruleCode
      }
    });

    if (duplicate) {
      return {
        ok: false,
        message: `规则编码 ${ruleCode} 已存在。`
      };
    }

    const graph = createDefaultRuleGraph(scene);
    const created = await prisma.$transaction(async (tx) => {
      const definition = await tx.ruleDefinition.create({
        data: {
          ruleCode,
          name,
          type,
          scene,
          status: RuleStatus.DRAFT
        }
      });

      const version = await tx.ruleVersion.create({
        data: {
          ruleId: definition.id,
          version: 1,
          graph
        }
      });

      return {
        definition,
        version
      };
    });

    await createAuditLog({
      operatorId: input.session.userId,
      action: "RULE_DEFINITION_CREATED",
      targetType: "RULE_DEFINITION",
      targetId: created.definition.id,
      detail: {
        ruleCode,
        scene,
        type,
        initialVersion: created.version.version
      }
    });

    return {
      ok: true,
      message: `规则 ${ruleCode} 已创建，并初始化 v1 草稿。`,
      ruleId: created.definition.id,
      versionId: created.version.id
    };
  }

  if (!id) {
    return {
      ok: false,
      message: "缺少待更新的规则 ID。"
    };
  }

  const rule = await prisma.ruleDefinition.findUnique({
    where: {
      id
    }
  });

  if (!rule) {
    return {
      ok: false,
      message: "目标规则不存在。"
    };
  }

  const duplicate = await prisma.ruleDefinition.findFirst({
    where: {
      ruleCode,
      NOT: {
        id
      }
    }
  });

  if (duplicate) {
    return {
      ok: false,
      message: `规则编码 ${ruleCode} 已存在。`
    };
  }

  await prisma.ruleDefinition.update({
    where: {
      id
    },
    data: {
      ruleCode,
      name,
      type,
      scene
    }
  });

  await createAuditLog({
    operatorId: input.session.userId,
    action: "RULE_DEFINITION_UPDATED",
    targetType: "RULE_DEFINITION",
    targetId: id,
    detail: {
      ruleCode,
      scene,
      type
    }
  });

  return {
    ok: true,
    message: `规则 ${ruleCode} 已更新。`,
    ruleId: id
  };
}

export async function performRuleVersionAction(
  input: RuleVersionActionInput
): Promise<ActionResult> {
  if (!hasPermission(input.session, "rules:manage")) {
    return {
      ok: false,
      message: "当前账号没有管理规则编排的权限。"
    };
  }

  const versionId = input.payload.versionId?.trim() ?? "";

  if (!versionId) {
    return {
      ok: false,
      message: "缺少目标规则版本 ID。"
    };
  }

  const version = await prisma.ruleVersion.findUnique({
    where: {
      id: versionId
    },
    include: {
      rule: true
    }
  });

  if (!version) {
    return {
      ok: false,
      message: "目标规则版本不存在。"
    };
  }

  const siblingVersions = await prisma.ruleVersion.findMany({
    where: {
      ruleId: version.ruleId
    },
    orderBy: {
      version: "desc"
    }
  });

  const activeVersionId = getActiveVersionId(siblingVersions);
  const preferredVersion = input.payload.targetVersion;

  if (input.action === "save-draft") {
    const graphResult = parseRuleGraphText(input.payload.graphText ?? "", version.rule.scene);

    if (!graphResult.ok) {
      return {
        ok: false,
        message: graphResult.message
      };
    }

    const publishInfo = parsePublishInfo(version.publishInfo);
    const shouldForkNewVersion = version.id === activeVersionId || Boolean(publishInfo);

    if (shouldForkNewVersion) {
      const nextVersionNumber = await getNextRuleVersionNumber(version.ruleId, preferredVersion);
      const duplicate = siblingVersions.find((item) => item.version === nextVersionNumber);

      if (duplicate) {
        return {
          ok: false,
          message: `版本号 v${nextVersionNumber} 已存在，请使用更大的版本号。`,
          ruleId: version.ruleId,
          versionId: version.id
        };
      }

      const createdVersion = await prisma.ruleVersion.create({
        data: {
          ruleId: version.ruleId,
          version: nextVersionNumber,
          graph: graphResult.value
        }
      });

      await createAuditLog({
        operatorId: input.session.userId,
        action: "RULE_VERSION_DRAFT_CREATED",
        targetType: "RULE_VERSION",
        targetId: createdVersion.id,
        detail: {
          ruleCode: version.rule.ruleCode,
          sourceVersion: version.version,
          targetVersion: createdVersion.version,
          note: input.payload.note?.trim() || null
        }
      });

      return {
        ok: true,
        message: `已基于 v${version.version} 生成草稿 v${createdVersion.version}。`,
        ruleId: version.ruleId,
        versionId: createdVersion.id
      };
    }

    await prisma.ruleVersion.update({
      where: {
        id: version.id
      },
      data: {
        graph: graphResult.value
      }
    });

    await createAuditLog({
      operatorId: input.session.userId,
      action: "RULE_VERSION_DRAFT_SAVED",
      targetType: "RULE_VERSION",
      targetId: version.id,
      detail: {
        ruleCode: version.rule.ruleCode,
        version: version.version,
        note: input.payload.note?.trim() || null
      }
    });

    return {
      ok: true,
      message: `规则 ${version.rule.ruleCode} 的 v${version.version} 草稿已保存。`,
      ruleId: version.ruleId,
      versionId: version.id
    };
  }

  if (input.action === "clone-version") {
    const nextVersionNumber = await getNextRuleVersionNumber(version.ruleId, preferredVersion);
    const duplicate = siblingVersions.find((item) => item.version === nextVersionNumber);

    if (duplicate) {
      return {
        ok: false,
        message: `版本号 v${nextVersionNumber} 已存在，请使用更大的版本号。`,
        ruleId: version.ruleId,
        versionId: version.id
      };
    }

    const clonedVersion = await prisma.ruleVersion.create({
      data: {
        ruleId: version.ruleId,
        version: nextVersionNumber,
        graph: normalizeRuleGraph(version.graph, version.rule.scene)
      }
    });

    await createAuditLog({
      operatorId: input.session.userId,
      action: "RULE_VERSION_CLONED",
      targetType: "RULE_VERSION",
      targetId: clonedVersion.id,
      detail: {
        ruleCode: version.rule.ruleCode,
        sourceVersion: version.version,
        targetVersion: clonedVersion.version,
        note: input.payload.note?.trim() || null
      }
    });

    return {
      ok: true,
      message: `已克隆规则版本，生成 v${clonedVersion.version} 草稿。`,
      ruleId: version.ruleId,
      versionId: clonedVersion.id
    };
  }

  const activationTime = new Date();
  const publishPayload = {
    publishedBy: input.session.name,
    publishedAt: activationTime.toISOString(),
    publishedAtText: formatDateTime(activationTime),
    mode: input.action === "publish" ? "publish" : "rollback",
    ...(input.payload.note?.trim() ? { note: input.payload.note.trim() } : {}),
    ...(input.payload.reason?.trim() ? { reason: input.payload.reason.trim() } : {})
  } satisfies Prisma.InputJsonObject;

  if (input.action === "rollback" && !input.payload.reason?.trim()) {
    return {
      ok: false,
      message: "执行规则回滚时必须填写回滚原因。",
      ruleId: version.ruleId,
      versionId: version.id
    };
  }

  if (version.rule.status === RuleStatus.DISABLED) {
    return {
      ok: false,
      message: `规则 ${version.rule.ruleCode} 当前已停用，请先启用后再执行发布或回滚。`,
      ruleId: version.ruleId,
      versionId: version.id
    };
  }

  if (
    input.action === "publish" &&
    version.id === activeVersionId &&
    version.rule.status === RuleStatus.PUBLISHED
  ) {
    return {
      ok: false,
      message: `规则 ${version.rule.ruleCode} v${version.version} 当前已是线上版本。`,
      ruleId: version.ruleId,
      versionId: version.id
    };
  }

  if (input.action === "rollback") {
    if (!parsePublishInfo(version.publishInfo)) {
      return {
        ok: false,
        message: `规则 ${version.rule.ruleCode} v${version.version} 从未发布，不能作为回滚目标。`,
        ruleId: version.ruleId,
        versionId: version.id
      };
    }

    if (version.id === activeVersionId && version.rule.status === RuleStatus.PUBLISHED) {
      return {
        ok: false,
        message: `规则 ${version.rule.ruleCode} v${version.version} 当前已是线上版本，无需回滚。`,
        ruleId: version.ruleId,
        versionId: version.id
      };
    }
  }

  await prisma.$transaction([
    prisma.ruleVersion.update({
      where: {
        id: version.id
      },
      data: {
        publishInfo: publishPayload
      }
    }),
    prisma.ruleDefinition.update({
      where: {
        id: version.ruleId
      },
      data: {
        status: RuleStatus.PUBLISHED
      }
    })
  ]);

  await createAuditLog({
    operatorId: input.session.userId,
    action: input.action === "publish" ? "RULE_VERSION_PUBLISHED" : "RULE_VERSION_ROLLED_BACK",
    targetType: "RULE_VERSION",
    targetId: version.id,
    detail: {
      ruleCode: version.rule.ruleCode,
      version: version.version,
      mode: publishPayload.mode,
      previousActiveVersionId: activeVersionId,
      note: input.payload.note?.trim() || null,
      reason: input.payload.reason?.trim() || null
    }
  });

  return {
    ok: true,
    message:
      input.action === "publish"
        ? `规则 ${version.rule.ruleCode} v${version.version} 已发布。`
        : `规则 ${version.rule.ruleCode} 已回滚到 v${version.version}。`,
    ruleId: version.ruleId,
    versionId: version.id
  };
}

export async function performRuleTestRunAction(
  input: RuleTestRunActionInput
): Promise<ActionResult> {
  if (!hasPermission(input.session, "rules:manage")) {
    return {
      ok: false,
      message: "当前账号没有试运行规则的权限。"
    };
  }

  const versionId = input.payload.versionId?.trim() ?? "";
  const orderId = input.payload.orderId?.trim() ?? "";
  const sampleInputText = input.payload.sampleInputText?.trim() ?? "";

  if (!versionId) {
    return {
      ok: false,
      message: "缺少目标规则版本 ID。"
    };
  }

  if (!sampleInputText) {
    return {
      ok: false,
      message: "试运行样例不能为空。"
    };
  }

  let parsedInput: Prisma.InputJsonValue;

  try {
    parsedInput = JSON.parse(sampleInputText) as Prisma.InputJsonValue;
  } catch {
    return {
      ok: false,
      message: "试运行样例解析失败，请输入合法 JSON。"
    };
  }

  if (!isJsonRecord(parsedInput)) {
    return {
      ok: false,
      message: "试运行样例必须是 JSON 对象。"
    };
  }

  const version = await prisma.ruleVersion.findUnique({
    where: {
      id: versionId
    },
    include: {
      rule: true
    }
  });

  if (!version) {
    return {
      ok: false,
      message: "目标规则版本不存在。"
    };
  }

  const graph = normalizeRuleGraph(version.graph, version.rule.scene);
  const graphIndex = buildRuleGraphIndex(graph);
  const pathLabels: string[] = [];
  const actionLabels: string[] = [];
  const conditionResults: Prisma.InputJsonObject[] = [];
  const branchResults: Prisma.InputJsonObject[] = [];
  const nodeExplanations: RuleNodeExplanation[] = [];
  let matched = true;
  let currentNode = graphIndex.startNode;
  const visitedNodeIds = new Set<string>();

  while (currentNode && !visitedNodeIds.has(currentNode.id)) {
    visitedNodeIds.add(currentNode.id);
    pathLabels.push(currentNode.data.label);

    if (currentNode.data.kind === "start") {
      nodeExplanations.push({
        nodeId: currentNode.id,
        nodeLabel: currentNode.data.label,
        nodeKind: currentNode.data.kind,
        outcome: "ENTERED",
        summary: currentNode.data.detail || `进入规则起点「${currentNode.data.label}」。`
      });
    }

    if (currentNode.data.kind === "condition") {
      const expression = parseRuleConditionExpressionConfig(currentNode.data.config);

      if (!expression) {
        conditionResults.push({
          nodeLabel: currentNode.data.label,
          matched: true,
          summary: "当前条件节点未配置显式表达式，试运行默认按主路径继续。"
        });
        nodeExplanations.push({
          nodeId: currentNode.id,
          nodeLabel: currentNode.data.label,
          nodeKind: currentNode.data.kind,
          outcome: "MATCHED",
          summary: "当前条件节点未配置显式表达式，试运行默认按主路径继续。"
        });
        currentNode = getLinearNextRuleNode(graphIndex, currentNode.id);
        continue;
      }

      const evaluation = evaluateRuleConditionExpression(expression, parsedInput);
      conditionResults.push({
        nodeLabel: currentNode.data.label,
        matched: evaluation.matched,
        expression: describeRuleConditionExpression(expression),
        summary: evaluation.summary
      });
      nodeExplanations.push({
        nodeId: currentNode.id,
        nodeLabel: currentNode.data.label,
        nodeKind: currentNode.data.kind,
        outcome: evaluation.matched ? "MATCHED" : "NOT_MATCHED",
        summary: evaluation.summary
      });

      if (!evaluation.matched) {
        matched = false;
        break;
      }
    }

    if (currentNode.data.kind === "branch") {
      const selection = resolveRuleBranchSelection({
        node: currentNode,
        outgoingEdges: graphIndex.outgoing.get(currentNode.id) ?? [],
        context: parsedInput
      });

      branchResults.push({
        nodeLabel: currentNode.data.label,
        mode: selection.mode,
        targetId: selection.targetId ?? null,
        targetLabel: selection.targetLabel ?? null,
        summary: selection.summary,
        evaluations: selection.evaluations.map((item) => ({
          label: item.label,
          target: item.target,
          matched: item.matched,
          expression: item.expression ?? null,
          summary: item.summary,
          detail: item.detail ?? null
        }))
      });
      nodeExplanations.push({
        nodeId: currentNode.id,
        nodeLabel: currentNode.data.label,
        nodeKind: currentNode.data.kind,
        outcome: "ROUTED",
        summary: selection.summary,
        detail: selection.targetLabel
          ? `目标路径：${selection.targetLabel}`
          : undefined
      });

      currentNode = selection.targetId
        ? graphIndex.nodesById.get(selection.targetId)
        : undefined;
      continue;
    }

    if (currentNode.data.kind === "action" || currentNode.data.kind === "result") {
      actionLabels.push(currentNode.data.label);
      nodeExplanations.push({
        nodeId: currentNode.id,
        nodeLabel: currentNode.data.label,
        nodeKind: currentNode.data.kind,
        outcome: currentNode.data.kind === "action" ? "EXECUTED" : "RESULT",
        summary:
          currentNode.data.kind === "action"
            ? `试运行到达动作节点「${currentNode.data.label}」。`
            : `试运行输出结果节点「${currentNode.data.label}」。`
      });
    }

    currentNode = getLinearNextRuleNode(graphIndex, currentNode.id);
  }

  const decision = matched
    ? inferDecision(version.rule.type, pathLabels)
    : {
        decision: "NO_MATCH",
        status: "NO_MATCH"
      };
  const reasonSummary = buildRuleReasonSummary(
    nodeExplanations,
    matched ? actionLabels.at(-1) ?? "" : "规则未命中",
    pathLabels.join(" -> ")
  );
  const explanationSummary = buildRuleExplanationSummary(
    nodeExplanations,
    matched ? actionLabels.at(-1) ?? "试运行完成" : "规则未命中",
    decision.decision
  );
  const durationMs = 48 + graph.nodes.length * 9 + graph.edges.length * 6;

  const log = await prisma.ruleExecLog.create({
    data: {
      ruleVersionId: version.id,
      orderId: orderId || null,
      scene: version.rule.scene,
      status: decision.status,
      durationMs,
      input: parsedInput,
      result: {
        decision: decision.decision,
        matched,
        path: pathLabels.join(" -> "),
        actionSummary: actionLabels,
        reasonSummary,
        explanationSummary,
        conditionResults,
        branchResults,
        nodeExplanations,
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length
      }
    }
  });

  await createAuditLog({
    operatorId: input.session.userId,
    action: "RULE_TEST_RUN_EXECUTED",
    targetType: "RULE_VERSION",
    targetId: version.id,
    detail: {
      ruleCode: version.rule.ruleCode,
      version: version.version,
      logId: log.id,
      orderId: orderId || null
    }
  });

  return {
    ok: true,
    message: `规则 ${version.rule.ruleCode} v${version.version} 试运行完成。`,
    ruleId: version.ruleId,
    versionId: version.id
  };
}
