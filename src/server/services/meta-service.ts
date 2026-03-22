import { Prisma, RecordStatus } from "@prisma/client";
import { hasPermission, type AuthSession } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import { createAuditLog } from "@/server/services/audit-service";

type ActionResult = {
  ok: boolean;
  message: string;
};

type MetaEntityActionInput = {
  action: "create" | "update" | "delete";
  session: AuthSession;
  payload: {
    id?: string;
    entityCode?: string;
    name?: string;
    type?: string;
    status?: RecordStatus;
    schemaText?: string;
  };
};

type MetaFieldActionInput = {
  action: "create" | "update" | "delete";
  session: AuthSession;
  payload: {
    id?: string;
    entityId?: string;
    fieldCode?: string;
    name?: string;
    type?: string;
    status?: RecordStatus;
    required?: boolean;
    schemaText?: string;
  };
};

type MetaPageActionInput = {
  action: "create" | "update" | "delete";
  session: AuthSession;
  payload: {
    id?: string;
    entityId?: string;
    pageCode?: string;
    pageType?: string;
    version?: number;
    status?: RecordStatus;
    schemaText?: string;
  };
};

type MetaPageVersionActionInput = {
  action: "publish" | "clone-version" | "rollback";
  session: AuthSession;
  payload: {
    pageId?: string;
    reason?: string;
    note?: string;
    targetVersion?: number;
  };
};

type MetaEntityVersionActionInput = {
  action: "publish" | "rollback";
  session: AuthSession;
  payload: {
    entityId?: string;
    snapshotId?: string;
    reason?: string;
    note?: string;
  };
};

type MetaFieldVersionActionInput = {
  action: "publish" | "rollback";
  session: AuthSession;
  payload: {
    fieldId?: string;
    snapshotId?: string;
    reason?: string;
    note?: string;
  };
};

type MetaOverviewSelection = {
  entityPreviewId?: string;
  pagePreviewId?: string;
  fieldPreviewId?: string;
};

export const recordStatusOptions: RecordStatus[] = [
  RecordStatus.DRAFT,
  RecordStatus.PUBLISHED,
  RecordStatus.DISABLED
];

export const metaEntityTypes = [
  "ORDER_EXTENSION",
  "CUSTOMER_EXTENSION",
  "WAREHOUSE_EXTENSION",
  "WORKBENCH_MODULE"
] as const;

export const metaFieldTypes = [
  "text",
  "number",
  "select",
  "date",
  "switch",
  "json"
] as const;

export const metaPageTypes = ["list", "detail", "form"] as const;

function formatDateTime(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function stringifySchema(value: Prisma.JsonValue | null) {
  return value ? JSON.stringify(value, null, 2) : "";
}

function previewSchema(value: Prisma.JsonValue | null, maxLength = 92) {
  if (!value) {
    return "-";
  }

  const text = JSON.stringify(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function isJsonRecord(value: Prisma.JsonValue | null | undefined): value is Prisma.JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatJsonValue(value: Prisma.JsonValue | undefined): string {
  if (Array.isArray(value)) {
    return value
      .slice(0, 3)
      .map((item) => formatJsonValue(item))
      .join(" / ");
  }

  if (isJsonRecord(value)) {
    return Object.entries(value)
      .slice(0, 2)
      .map(([key, item]) => `${key}=${formatJsonValue(item ?? null)}`)
      .join(", ");
  }

  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }

  if (value === null) {
    return "空";
  }

  return String(value ?? "");
}

function summarizeJsonEntries(value: Prisma.JsonValue | null | undefined) {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.slice(0, 4).map((item) => formatJsonValue(item));
  }

  if (isJsonRecord(value)) {
    return Object.entries(value)
      .slice(0, 4)
      .map(([key, item]) => `${key}: ${formatJsonValue(item ?? null)}`);
  }

  return [formatJsonValue(value)];
}

function jsonContainsString(value: Prisma.JsonValue | null | undefined, target: string): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value === target;
  }

  if (Array.isArray(value)) {
    return value.some((item) => jsonContainsString(item, target));
  }

  if (isJsonRecord(value)) {
    return Object.values(value).some((item) => jsonContainsString(item ?? null, target));
  }

  return false;
}

async function getNextSnapshotVersion(targetType: string, targetId: string) {
  const latest = await prisma.metaConfigSnapshot.findFirst({
    where: {
      targetType,
      targetId
    },
    orderBy: {
      version: "desc"
    },
    select: {
      version: true
    }
  });

  return (latest?.version ?? 0) + 1;
}

function buildEntitySnapshotPayload(entity: {
  entityCode: string;
  name: string;
  type: string;
  status: RecordStatus;
  schema: Prisma.JsonValue | null;
}) {
  return {
    entityCode: entity.entityCode,
    name: entity.name,
    type: entity.type,
    status: entity.status,
    schema: entity.schema
  } satisfies Prisma.InputJsonObject;
}

function buildFieldSnapshotPayload(field: {
  entityId: string;
  fieldCode: string;
  name: string;
  type: string;
  status: RecordStatus;
  required: boolean;
  schema: Prisma.JsonValue | null;
}) {
  return {
    entityId: field.entityId,
    fieldCode: field.fieldCode,
    name: field.name,
    type: field.type,
    status: field.status,
    required: field.required,
    schema: field.schema
  } satisfies Prisma.InputJsonObject;
}

async function createMetaSnapshot(input: {
  targetType: "ENTITY_META" | "FIELD_META";
  targetId: string;
  targetCode: string;
  entityId?: string | null;
  fieldId?: string | null;
  status?: string | null;
  action: string;
  note?: string | null;
  snapshot: Prisma.InputJsonValue;
  operatorId?: string | null;
  version?: number;
}) {
  const version =
    typeof input.version === "number"
      ? input.version
      : await getNextSnapshotVersion(input.targetType, input.targetId);

  await prisma.metaConfigSnapshot.create({
    data: {
      targetType: input.targetType,
      targetId: input.targetId,
      targetCode: input.targetCode,
      entityId: input.entityId ?? null,
      fieldId: input.fieldId ?? null,
      version,
      status: input.status ?? null,
      action: input.action,
      note: input.note ?? null,
      snapshot: input.snapshot,
      operatorId: input.operatorId ?? null
    }
  });

  return version;
}

function parseEntitySnapshot(
  snapshot: Prisma.JsonValue | null | undefined
): {
  entityCode: string;
  name: string;
  type: string;
  status: RecordStatus;
  schema: Prisma.InputJsonValue | typeof Prisma.DbNull;
} | null {
  if (!isJsonRecord(snapshot)) {
    return null;
  }

  const status = typeof snapshot.status === "string" ? snapshot.status : "";

  if (
    typeof snapshot.entityCode !== "string" ||
    typeof snapshot.name !== "string" ||
    typeof snapshot.type !== "string" ||
    !isValidRecordStatus(status)
  ) {
    return null;
  }

  return {
    entityCode: snapshot.entityCode,
    name: snapshot.name,
    type: snapshot.type,
    status,
    schema:
      snapshot.schema === undefined
        ? Prisma.DbNull
        : (snapshot.schema as Prisma.InputJsonValue | null) ?? Prisma.DbNull
  };
}

function parseFieldSnapshot(
  snapshot: Prisma.JsonValue | null | undefined
): {
  entityId: string;
  fieldCode: string;
  name: string;
  type: string;
  status: RecordStatus;
  required: boolean;
  schema: Prisma.InputJsonValue | typeof Prisma.DbNull;
} | null {
  if (!isJsonRecord(snapshot)) {
    return null;
  }

  const status = typeof snapshot.status === "string" ? snapshot.status : "";

  if (
    typeof snapshot.entityId !== "string" ||
    typeof snapshot.fieldCode !== "string" ||
    typeof snapshot.name !== "string" ||
    typeof snapshot.type !== "string" ||
    !isValidRecordStatus(status)
  ) {
    return null;
  }

  return {
    entityId: snapshot.entityId,
    fieldCode: snapshot.fieldCode,
    name: snapshot.name,
    type: snapshot.type,
    status,
    required: Boolean(snapshot.required),
    schema:
      snapshot.schema === undefined
        ? Prisma.DbNull
        : (snapshot.schema as Prisma.InputJsonValue | null) ?? Prisma.DbNull
  };
}

async function getEntityDependencies(entityId: string) {
  const [fieldCount, pages, snapshots] = await Promise.all([
    prisma.fieldMeta.count({
      where: {
        entityId
      }
    }),
    prisma.pageMeta.findMany({
      where: {
        entityId
      },
      orderBy: [{ pageCode: "asc" }, { version: "desc" }]
    }),
    prisma.metaConfigSnapshot.count({
      where: {
        targetType: "ENTITY_META",
        targetId: entityId
      }
    })
  ]);

  const publishedPages = pages.filter((page) => page.status === RecordStatus.PUBLISHED);
  const pageGroups = new Set(pages.map((page) => page.pageCode));

  return {
    fieldCount,
    pageCount: pages.length,
    pageGroupCount: pageGroups.size,
    publishedPageCount: publishedPages.length,
    snapshotCount: snapshots
  };
}

async function getFieldDependencies(fieldId: string) {
  const field = await prisma.fieldMeta.findUnique({
    where: {
      id: fieldId
    },
    include: {
      entity: true
    }
  });

  if (!field) {
    return null;
  }

  const [pages, snapshots] = await Promise.all([
    prisma.pageMeta.findMany({
      where: {
        entityId: field.entityId
      },
      orderBy: [{ pageCode: "asc" }, { version: "desc" }]
    }),
    prisma.metaConfigSnapshot.count({
      where: {
        targetType: "FIELD_META",
        targetId: field.id
      }
    })
  ]);

  const matchedPages = pages.filter((page) => jsonContainsString(page.schema, field.fieldCode));

  return {
    field,
    pages: matchedPages,
    pageCount: matchedPages.length,
    publishedPageCount: matchedPages.filter((page) => page.status === RecordStatus.PUBLISHED).length,
    snapshotCount: snapshots
  };
}

function isValidRecordStatus(value?: string): value is RecordStatus {
  return recordStatusOptions.includes(value as RecordStatus);
}

function validateEntityCode(value: string) {
  return /^[A-Z][A-Z0-9_]{1,47}$/.test(value);
}

function validateFieldCode(value: string) {
  return /^[a-z][a-z0-9_]{1,47}$/.test(value);
}

function validatePageCode(value: string) {
  return /^[a-z][a-z0-9_]{1,47}$/.test(value);
}

function parseSchemaText(schemaText: string, required: boolean) {
  const trimmed = schemaText.trim();

  if (!trimmed) {
    return required
      ? {
          ok: false as const,
          message: "Schema 不能为空，且必须是合法 JSON。"
        }
      : {
          ok: true as const,
          value: undefined,
          provided: false
        };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;

    if (parsed === null || typeof parsed !== "object") {
      return {
        ok: false as const,
        message: "Schema 必须是 JSON 对象或数组。"
      };
    }

    return {
      ok: true as const,
      value: parsed as Prisma.InputJsonValue,
      provided: true
    };
  } catch {
    return {
      ok: false as const,
      message: "Schema 解析失败，请输入合法 JSON。"
    };
  }
}

export async function getMetaManagementOverview(
  selection: MetaOverviewSelection = {}
) {
  const [entities, fields, pages, releaseLogs] = await Promise.all([
    prisma.entityMeta.findMany({
      include: {
        _count: {
          select: {
            fields: true,
            pages: true
          }
        }
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }]
    }),
    prisma.fieldMeta.findMany({
      include: {
        entity: true
      },
      orderBy: [{ entity: { entityCode: "asc" } }, { createdAt: "asc" }]
    }),
    prisma.pageMeta.findMany({
      include: {
        entity: true
      },
      orderBy: [{ entity: { entityCode: "asc" } }, { createdAt: "asc" }]
    }),
    prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            "META_ENTITY_PUBLISHED",
            "META_ENTITY_DISABLED",
            "META_ENTITY_ROLLED_BACK",
            "META_FIELD_PUBLISHED",
            "META_FIELD_ROLLED_BACK",
            "META_PAGE_PUBLISHED",
            "META_PAGE_VERSION_CLONED",
            "META_PAGE_ROLLED_BACK"
          ]
        }
      },
      include: {
        operator: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 12
    })
  ]);

  const entityItems = entities.map((entity) => ({
    id: entity.id,
    entityCode: entity.entityCode,
    name: entity.name,
    type: entity.type,
    status: entity.status,
    version: entity.version,
    fieldCount: entity._count.fields,
    pageCount: entity._count.pages,
    schemaPreview: previewSchema(entity.schema),
    rawSchema: stringifySchema(entity.schema),
    updatedAt: formatDateTime(entity.updatedAt)
  }));

  const fieldItems = fields.map((field) => ({
    id: field.id,
    entityId: field.entityId,
    entityCode: field.entity.entityCode,
    entityName: field.entity.name,
    fieldCode: field.fieldCode,
    name: field.name,
    type: field.type,
    status: field.status,
    version: field.version,
    required: field.required,
    schemaPreview: previewSchema(field.schema),
    rawSchema: stringifySchema(field.schema),
    updatedAt: formatDateTime(field.updatedAt)
  }));

  const pageItems = pages.map((page) => ({
    id: page.id,
    entityId: page.entityId,
    entityCode: page.entity.entityCode,
    entityName: page.entity.name,
    pageCode: page.pageCode,
    pageType: page.pageType,
    version: page.version,
    status: page.status,
    schemaPreview: previewSchema(page.schema),
    rawSchema: stringifySchema(page.schema),
    updatedAt: formatDateTime(page.updatedAt)
  }));

  const pageGroups = Array.from(
    pageItems.reduce(
      (groups, page) => {
        const key = `${page.entityId}:${page.pageCode}`;
        const current = groups.get(key) ?? {
          key,
          entityId: page.entityId,
          entityCode: page.entityCode,
          entityName: page.entityName,
          pageCode: page.pageCode,
          pageType: page.pageType,
          versions: [] as typeof pageItems
        };

        current.versions.push(page);
        groups.set(key, current);
        return groups;
      },
      new Map<
        string,
        {
          key: string;
          entityId: string;
          entityCode: string;
          entityName: string;
          pageCode: string;
          pageType: string;
          versions: typeof pageItems;
        }
      >()
    ).values()
  )
    .map((group) => {
      const versions = [...group.versions].sort((left, right) => right.version - left.version);
      const publishedVersion = versions.find((item) => item.status === RecordStatus.PUBLISHED) ?? null;

      return {
        ...group,
        versions,
        versionCount: versions.length,
        latestVersion: versions[0]?.version ?? null,
        publishedVersion: publishedVersion?.version ?? null,
        publishedPageId: publishedVersion?.id ?? null,
        draftCount: versions.filter((item) => item.status === RecordStatus.DRAFT).length
      };
    })
    .sort((left, right) => left.entityCode.localeCompare(right.entityCode));

  const previewEntity =
    entityItems.find((item) => item.id === selection.entityPreviewId) ??
    entityItems.find((item) => item.status === RecordStatus.PUBLISHED) ??
    entityItems[0] ??
    null;
  const previewFields = previewEntity
    ? fieldItems.filter((item) => item.entityId === previewEntity.id)
    : [];
  const previewField =
    previewFields.find((item) => item.id === selection.fieldPreviewId) ??
    previewFields.find((item) => item.status === RecordStatus.PUBLISHED) ??
    previewFields[0] ??
    null;
  const previewPageGroups = previewEntity
    ? pageGroups.filter((item) => item.entityId === previewEntity.id)
    : [];
  const previewPages = previewEntity
    ? pageItems
        .filter((item) => item.entityId === previewEntity.id)
        .sort((left, right) => right.version - left.version)
    : [];
  const previewPage =
    previewPages.find((item) => item.id === selection.pagePreviewId) ??
    previewPages.find((item) => item.status === RecordStatus.PUBLISHED) ??
    previewPages[0] ??
    null;
  const previewPageGroup = previewPage
    ? pageGroups.find(
        (item) =>
          item.entityId === previewPage.entityId && item.pageCode === previewPage.pageCode
      ) ?? null
    : null;
  const [
    previewEntityDependencies,
    previewFieldDependencies,
    previewEntitySnapshots,
    previewFieldSnapshots
  ] = await Promise.all([
    previewEntity ? getEntityDependencies(previewEntity.id) : null,
    previewField ? getFieldDependencies(previewField.id) : null,
    previewEntity
      ? prisma.metaConfigSnapshot.findMany({
          where: {
            targetType: "ENTITY_META",
            targetId: previewEntity.id
          },
          include: {
            operator: true
          },
          orderBy: {
            version: "desc"
          }
        })
      : [],
    previewField
      ? prisma.metaConfigSnapshot.findMany({
          where: {
            targetType: "FIELD_META",
            targetId: previewField.id
          },
          include: {
            operator: true
          },
          orderBy: {
            version: "desc"
          }
        })
      : []
  ]);
  const releaseHistory = releaseLogs.map((log) => ({
    id: log.id,
    createdAt: formatDateTime(log.createdAt),
    action: log.action,
    operatorName: log.operator?.name ?? "系统",
    targetType: log.targetType,
    targetId: log.targetId ?? "-",
    detailEntries: summarizeJsonEntries(log.detail)
  }));

  const entityReadyChecks = previewEntity
    ? [
        {
          label: "实体状态",
          passed: previewEntity.status !== RecordStatus.DISABLED,
          text:
            previewEntity.status === RecordStatus.DISABLED
              ? "当前实体为 DISABLED，不能继续发布页面。"
              : `当前实体状态为 ${previewEntity.status}。`
        },
        {
          label: "字段完备度",
          passed: previewFields.length > 0,
          text:
            previewFields.length > 0
              ? `已定义 ${previewFields.length} 个字段。`
              : "当前实体还没有字段定义。"
        },
        {
          label: "页面配置",
          passed: previewPageGroups.length > 0,
          text:
            previewPageGroups.length > 0
              ? `已定义 ${previewPageGroups.length} 组页面版本。`
              : "当前实体还没有页面配置。"
        }
      ]
    : [];
  const previewFieldDependencyItems =
    previewFieldDependencies?.pages.map((page) => ({
      id: page.id,
      pageCode: page.pageCode,
      pageType: page.pageType,
      version: page.version,
      status: page.status,
      schemaPreview: previewSchema(page.schema)
    })) ?? [];
  const entitySnapshotItems = previewEntitySnapshots.map((snapshot) => ({
    id: snapshot.id,
    version: snapshot.version,
    status: snapshot.status ?? "-",
    action: snapshot.action,
    note: snapshot.note ?? "",
    createdAt: formatDateTime(snapshot.createdAt),
    operatorName: snapshot.operator?.name ?? "系统",
    snapshotEntries: summarizeJsonEntries(snapshot.snapshot)
  }));
  const fieldSnapshotItems = previewFieldSnapshots.map((snapshot) => ({
    id: snapshot.id,
    version: snapshot.version,
    status: snapshot.status ?? "-",
    action: snapshot.action,
    note: snapshot.note ?? "",
    createdAt: formatDateTime(snapshot.createdAt),
    operatorName: snapshot.operator?.name ?? "系统",
    snapshotEntries: summarizeJsonEntries(snapshot.snapshot)
  }));

  return {
    entities: entityItems,
    fields: fieldItems,
    pages: pageItems,
    pageGroups,
    preview: {
      entity: previewEntity,
      fields: previewFields,
      field: previewField,
      pages: previewPages,
      page: previewPage,
      pageGroup: previewPageGroup,
      readyChecks: entityReadyChecks,
      entityDependencies: previewEntityDependencies,
      fieldDependencies: previewFieldDependencies
    },
    entitySnapshots: entitySnapshotItems,
    fieldSnapshots: fieldSnapshotItems,
    fieldDependencyItems: previewFieldDependencyItems,
    releaseHistory,
    entityOptions: entityItems.map((entity) => ({
      id: entity.id,
      entityCode: entity.entityCode,
      name: entity.name
    })),
    fieldOptions: previewFields.map((field) => ({
      id: field.id,
      fieldCode: field.fieldCode,
      name: field.name
    })),
    options: {
      recordStatuses: recordStatusOptions,
      entityTypes: [...metaEntityTypes],
      fieldTypes: [...metaFieldTypes],
      pageTypes: [...metaPageTypes]
    },
    summary: {
      totalEntities: entityItems.length,
      totalFields: fieldItems.length,
      totalPages: pageItems.length,
      versionedPageGroups: pageGroups.length,
      publishedRecords:
        entityItems.filter((item) => item.status === RecordStatus.PUBLISHED).length +
        fieldItems.filter((item) => item.status === RecordStatus.PUBLISHED).length +
        pageItems.filter((item) => item.status === RecordStatus.PUBLISHED).length
    }
  };
}

export async function performMetaEntityAction(
  input: MetaEntityActionInput
): Promise<ActionResult> {
  if (!hasPermission(input.session, "meta:manage")) {
    return {
      ok: false,
      message: "当前账号没有管理低代码配置的权限。"
    };
  }

  const id = input.payload.id?.trim() ?? "";
  const entityCode = input.payload.entityCode?.trim().toUpperCase() ?? "";
  const name = input.payload.name?.trim() ?? "";
  const type = input.payload.type?.trim() ?? "";
  const status = input.payload.status;
  const schemaResult = parseSchemaText(input.payload.schemaText ?? "", false);

  if (!schemaResult.ok) {
    return {
      ok: false,
      message: schemaResult.message
    };
  }

  if (input.action === "delete") {
    if (!id) {
      return {
        ok: false,
        message: "缺少待删除的实体 ID。"
      };
    }

    const entity = await prisma.entityMeta.findUnique({
      where: {
        id
      },
      include: {
        _count: {
          select: {
            fields: true,
            pages: true
          }
        }
      }
    });

    if (!entity) {
      return {
        ok: false,
        message: "目标实体不存在。"
      };
    }

    if (entity._count.fields > 0 || entity._count.pages > 0) {
      return {
        ok: false,
        message: `实体 ${entity.entityCode} 仍存在 ${entity._count.fields} 个字段和 ${entity._count.pages} 份页面配置，不能直接删除。`
      };
    }

    await prisma.entityMeta.delete({
      where: {
        id
      }
    });

    await createAuditLog({
      operatorId: input.session.userId,
      action: "META_ENTITY_DELETED",
      targetType: "ENTITY_META",
      targetId: entity.id,
      detail: {
        entityCode: entity.entityCode,
        fieldCount: entity._count.fields,
        pageCount: entity._count.pages
      }
    });

    return {
      ok: true,
      message: `实体 ${entity.entityCode} 已删除。`
    };
  }

  if (!entityCode || !validateEntityCode(entityCode)) {
    return {
      ok: false,
      message: "实体编码需使用大写字母、数字和下划线，且以字母开头。"
    };
  }

  if (!name || !type || !status || !isValidRecordStatus(status)) {
    return {
      ok: false,
      message: "请完整填写实体名称、类型和状态。"
    };
  }

  if (input.action === "create") {
    const duplicate = await prisma.entityMeta.findUnique({
      where: {
        entityCode
      }
    });

    if (duplicate) {
      return {
        ok: false,
        message: `实体编码 ${entityCode} 已存在。`
      };
    }

    const entity = await prisma.entityMeta.create({
      data: {
        entityCode,
        name,
        type,
        status,
        ...(schemaResult.provided ? { schema: schemaResult.value } : {})
      }
    });

    await createMetaSnapshot({
      targetType: "ENTITY_META",
      targetId: entity.id,
      targetCode: entity.entityCode,
      entityId: entity.id,
      status: entity.status,
      action: "META_ENTITY_CREATED",
      snapshot: buildEntitySnapshotPayload(entity),
      operatorId: input.session.userId,
      version: entity.version
    });

    await createAuditLog({
      operatorId: input.session.userId,
      action: "META_ENTITY_CREATED",
      targetType: "ENTITY_META",
      targetId: entity.id,
      detail: {
        entityCode,
        type,
        status
      }
    });

    return {
      ok: true,
      message: `实体 ${entityCode} 已创建。`
    };
  }

  if (!id) {
    return {
      ok: false,
      message: "缺少待更新的实体 ID。"
    };
  }

  const entity = await prisma.entityMeta.findUnique({
    where: {
      id
    }
  });

  if (!entity) {
    return {
      ok: false,
      message: "目标实体不存在。"
    };
  }

  const duplicate = await prisma.entityMeta.findFirst({
    where: {
      entityCode,
      NOT: {
        id
      }
    }
  });

  if (duplicate) {
    return {
      ok: false,
      message: `实体编码 ${entityCode} 已被其他实体占用。`
    };
  }

  const nextVersion = entity.version + 1;
  const nextSchema = schemaResult.provided ? schemaResult.value : Prisma.DbNull;

  const updatedEntity = await prisma.entityMeta.update({
    where: {
      id
    },
    data: {
      entityCode,
      name,
      type,
      status,
      version: nextVersion,
      schema: nextSchema
    }
  });

  await createMetaSnapshot({
    targetType: "ENTITY_META",
    targetId: updatedEntity.id,
    targetCode: updatedEntity.entityCode,
    entityId: updatedEntity.id,
    status: updatedEntity.status,
    action: "META_ENTITY_UPDATED",
    snapshot: buildEntitySnapshotPayload(updatedEntity),
    operatorId: input.session.userId,
    version: updatedEntity.version
  });

  await createAuditLog({
    operatorId: input.session.userId,
    action: "META_ENTITY_UPDATED",
    targetType: "ENTITY_META",
    targetId: entity.id,
    detail: {
      beforeCode: entity.entityCode,
      afterCode: entityCode,
      beforeStatus: entity.status,
      afterStatus: status
    }
  });

  return {
    ok: true,
    message: `实体 ${entityCode} 已更新。`
  };
}

export async function performMetaFieldAction(
  input: MetaFieldActionInput
): Promise<ActionResult> {
  if (!hasPermission(input.session, "meta:manage")) {
    return {
      ok: false,
      message: "当前账号没有管理低代码配置的权限。"
    };
  }

  const id = input.payload.id?.trim() ?? "";
  const entityId = input.payload.entityId?.trim() ?? "";
  const fieldCode = input.payload.fieldCode?.trim() ?? "";
  const name = input.payload.name?.trim() ?? "";
  const type = input.payload.type?.trim() ?? "";
  const status = input.payload.status ?? RecordStatus.DRAFT;
  const required = Boolean(input.payload.required);
  const schemaResult = parseSchemaText(input.payload.schemaText ?? "", false);

  if (!schemaResult.ok) {
    return {
      ok: false,
      message: schemaResult.message
    };
  }

  if (input.action === "delete") {
    if (!id) {
      return {
        ok: false,
        message: "缺少待删除的字段 ID。"
      };
    }

    const field = await prisma.fieldMeta.findUnique({
      where: {
        id
      },
      include: {
        entity: true
      }
    });

    if (!field) {
      return {
        ok: false,
        message: "目标字段不存在。"
      };
    }

    const dependencies = await getFieldDependencies(field.id);

    if ((dependencies?.pageCount ?? 0) > 0) {
      return {
        ok: false,
        message: `字段 ${field.fieldCode} 已被 ${dependencies?.pageCount ?? 0} 份页面配置引用，不能直接删除。`
      };
    }

    await prisma.fieldMeta.delete({
      where: {
        id
      }
    });

    await createAuditLog({
      operatorId: input.session.userId,
      action: "META_FIELD_DELETED",
      targetType: "FIELD_META",
      targetId: field.id,
      detail: {
        entityCode: field.entity.entityCode,
        fieldCode: field.fieldCode
      }
    });

    return {
      ok: true,
      message: `字段 ${field.fieldCode} 已删除。`
    };
  }

  if (
    !entityId ||
    !fieldCode ||
    !validateFieldCode(fieldCode) ||
    !name ||
    !type ||
    !isValidRecordStatus(status)
  ) {
    return {
      ok: false,
      message:
        "请完整填写实体、字段编码、名称、类型和状态；字段编码需为小写字母、数字和下划线。"
    };
  }

  const entity = await prisma.entityMeta.findUnique({
    where: {
      id: entityId
    }
  });

  if (!entity) {
    return {
      ok: false,
      message: "所选实体不存在。"
    };
  }

  if (input.action === "create") {
    const duplicate = await prisma.fieldMeta.findFirst({
      where: {
        entityId,
        fieldCode
      }
    });

    if (duplicate) {
      return {
        ok: false,
        message: `实体 ${entity.entityCode} 下已存在字段 ${fieldCode}。`
      };
    }

    const field = await prisma.fieldMeta.create({
      data: {
        entityId,
        fieldCode,
        name,
        type,
        status,
        required,
        ...(schemaResult.provided ? { schema: schemaResult.value } : {})
      }
    });

    await createMetaSnapshot({
      targetType: "FIELD_META",
      targetId: field.id,
      targetCode: field.fieldCode,
      entityId: field.entityId,
      fieldId: field.id,
      status: field.status,
      action: "META_FIELD_CREATED",
      snapshot: buildFieldSnapshotPayload(field),
      operatorId: input.session.userId,
      version: field.version
    });

    await createAuditLog({
      operatorId: input.session.userId,
      action: "META_FIELD_CREATED",
      targetType: "FIELD_META",
      targetId: field.id,
      detail: {
        entityCode: entity.entityCode,
        fieldCode,
        type,
        status,
        required
      }
    });

    return {
      ok: true,
      message: `字段 ${fieldCode} 已创建。`
    };
  }

  if (!id) {
    return {
      ok: false,
      message: "缺少待更新的字段 ID。"
    };
  }

  const field = await prisma.fieldMeta.findUnique({
    where: {
      id
    },
    include: {
      entity: true
    }
  });

  if (!field) {
    return {
      ok: false,
      message: "目标字段不存在。"
    };
  }

  const duplicate = await prisma.fieldMeta.findFirst({
    where: {
      entityId,
      fieldCode,
      NOT: {
        id
      }
    }
  });

  if (duplicate) {
    return {
      ok: false,
      message: `实体 ${entity.entityCode} 下已有同名字段编码。`
    };
  }

  const nextVersion = field.version + 1;
  const nextSchema = schemaResult.provided ? schemaResult.value : Prisma.DbNull;
  const updatedField = await prisma.fieldMeta.update({
    where: {
      id
    },
    data: {
      entityId,
      fieldCode,
      name,
      type,
      status,
      version: nextVersion,
      required,
      schema: nextSchema
    }
  });

  await createMetaSnapshot({
    targetType: "FIELD_META",
    targetId: updatedField.id,
    targetCode: updatedField.fieldCode,
    entityId: updatedField.entityId,
    fieldId: updatedField.id,
    status: updatedField.status,
    action: "META_FIELD_UPDATED",
    snapshot: buildFieldSnapshotPayload(updatedField),
    operatorId: input.session.userId,
    version: updatedField.version
  });

  await createAuditLog({
    operatorId: input.session.userId,
    action: "META_FIELD_UPDATED",
    targetType: "FIELD_META",
    targetId: field.id,
    detail: {
      beforeEntityCode: field.entity.entityCode,
      afterEntityCode: entity.entityCode,
      beforeFieldCode: field.fieldCode,
      afterFieldCode: fieldCode,
      beforeStatus: field.status,
      afterStatus: status
    }
  });

  return {
    ok: true,
    message: `字段 ${fieldCode} 已更新。`
  };
}

export async function performMetaEntityVersionAction(
  input: MetaEntityVersionActionInput
): Promise<ActionResult> {
  if (!hasPermission(input.session, "meta:manage")) {
    return {
      ok: false,
      message: "当前账号没有管理低代码配置的权限。"
    };
  }

  const entityId = input.payload.entityId?.trim() ?? "";
  const snapshotId = input.payload.snapshotId?.trim() ?? "";

  if (!entityId) {
    return {
      ok: false,
      message: "缺少目标实体 ID。"
    };
  }

  const entity = await prisma.entityMeta.findUnique({
    where: {
      id: entityId
    }
  });

  if (!entity) {
    return {
      ok: false,
      message: "目标实体不存在。"
    };
  }

  if (input.action === "publish") {
    const dependencies = await getEntityDependencies(entity.id);

    if (!dependencies || dependencies.fieldCount === 0 || dependencies.pageCount === 0) {
      return {
        ok: false,
        message: `实体 ${entity.entityCode} 至少需要 1 个字段和 1 份页面配置后才能发布。`
      };
    }

    if (entity.status === RecordStatus.PUBLISHED) {
      return {
        ok: true,
        message: `实体 ${entity.entityCode} 当前已经是发布状态。`
      };
    }

    const nextVersion = entity.version + 1;
    const publishedEntity = await prisma.entityMeta.update({
      where: {
        id: entity.id
      },
      data: {
        status: RecordStatus.PUBLISHED,
        version: nextVersion
      }
    });

    await createMetaSnapshot({
      targetType: "ENTITY_META",
      targetId: publishedEntity.id,
      targetCode: publishedEntity.entityCode,
      entityId: publishedEntity.id,
      status: publishedEntity.status,
      action: "META_ENTITY_PUBLISHED",
      note: input.payload.note?.trim() || null,
      snapshot: buildEntitySnapshotPayload(publishedEntity),
      operatorId: input.session.userId,
      version: publishedEntity.version
    });

    await createAuditLog({
      operatorId: input.session.userId,
      action: "META_ENTITY_PUBLISHED",
      targetType: "ENTITY_META",
      targetId: publishedEntity.id,
      detail: {
        entityCode: publishedEntity.entityCode,
        version: publishedEntity.version,
        note: input.payload.note?.trim() || null
      }
    });

    return {
      ok: true,
      message: `实体 ${publishedEntity.entityCode} 已发布。`
    };
  }

  const reason = input.payload.reason?.trim() ?? "";

  if (!snapshotId) {
    return {
      ok: false,
      message: "缺少目标快照 ID。"
    };
  }

  if (!reason) {
    return {
      ok: false,
      message: "执行实体回滚时必须填写回滚原因。"
    };
  }

  const snapshot = await prisma.metaConfigSnapshot.findUnique({
    where: {
      id: snapshotId
    }
  });

  if (!snapshot || snapshot.targetType !== "ENTITY_META" || snapshot.targetId !== entity.id) {
    return {
      ok: false,
      message: "目标实体快照不存在。"
    };
  }

  const parsedSnapshot = parseEntitySnapshot(snapshot.snapshot);

  if (!parsedSnapshot) {
    return {
      ok: false,
      message: "实体快照内容已损坏，无法回滚。"
    };
  }

  const duplicate = await prisma.entityMeta.findFirst({
    where: {
      entityCode: parsedSnapshot.entityCode,
      NOT: {
        id: entity.id
      }
    }
  });

  if (duplicate) {
    return {
      ok: false,
      message: `实体编码 ${parsedSnapshot.entityCode} 已被其他实体占用，无法回滚。`
    };
  }

  const nextVersion = entity.version + 1;
  const rolledBackEntity = await prisma.entityMeta.update({
    where: {
      id: entity.id
    },
    data: {
      entityCode: parsedSnapshot.entityCode,
      name: parsedSnapshot.name,
      type: parsedSnapshot.type,
      status: parsedSnapshot.status,
      version: nextVersion,
      schema: parsedSnapshot.schema
    }
  });

  await createMetaSnapshot({
    targetType: "ENTITY_META",
    targetId: rolledBackEntity.id,
    targetCode: rolledBackEntity.entityCode,
    entityId: rolledBackEntity.id,
    status: rolledBackEntity.status,
    action: "META_ENTITY_ROLLED_BACK",
    note: reason,
    snapshot: buildEntitySnapshotPayload(rolledBackEntity),
    operatorId: input.session.userId,
    version: rolledBackEntity.version
  });

  await createAuditLog({
    operatorId: input.session.userId,
    action: "META_ENTITY_ROLLED_BACK",
    targetType: "ENTITY_META",
    targetId: rolledBackEntity.id,
    detail: {
      entityCode: rolledBackEntity.entityCode,
      fromSnapshotVersion: snapshot.version,
      toVersion: rolledBackEntity.version,
      reason
    }
  });

  return {
    ok: true,
    message: `实体 ${rolledBackEntity.entityCode} 已回滚到快照 v${snapshot.version}。`
  };
}

export async function performMetaFieldVersionAction(
  input: MetaFieldVersionActionInput
): Promise<ActionResult> {
  if (!hasPermission(input.session, "meta:manage")) {
    return {
      ok: false,
      message: "当前账号没有管理低代码配置的权限。"
    };
  }

  const fieldId = input.payload.fieldId?.trim() ?? "";
  const snapshotId = input.payload.snapshotId?.trim() ?? "";

  if (!fieldId) {
    return {
      ok: false,
      message: "缺少目标字段 ID。"
    };
  }

  const field = await prisma.fieldMeta.findUnique({
    where: {
      id: fieldId
    },
    include: {
      entity: true
    }
  });

  if (!field) {
    return {
      ok: false,
      message: "目标字段不存在。"
    };
  }

  if (input.action === "publish") {
    if (field.entity.status === RecordStatus.DISABLED) {
      return {
        ok: false,
        message: `字段所属实体 ${field.entity.entityCode} 已停用，不能发布字段。`
      };
    }

    if (field.status === RecordStatus.PUBLISHED) {
      return {
        ok: true,
        message: `字段 ${field.fieldCode} 当前已经是发布状态。`
      };
    }

    const nextVersion = field.version + 1;
    const publishedField = await prisma.fieldMeta.update({
      where: {
        id: field.id
      },
      data: {
        status: RecordStatus.PUBLISHED,
        version: nextVersion
      }
    });

    await createMetaSnapshot({
      targetType: "FIELD_META",
      targetId: publishedField.id,
      targetCode: publishedField.fieldCode,
      entityId: publishedField.entityId,
      fieldId: publishedField.id,
      status: publishedField.status,
      action: "META_FIELD_PUBLISHED",
      note: input.payload.note?.trim() || null,
      snapshot: buildFieldSnapshotPayload(publishedField),
      operatorId: input.session.userId,
      version: publishedField.version
    });

    await createAuditLog({
      operatorId: input.session.userId,
      action: "META_FIELD_PUBLISHED",
      targetType: "FIELD_META",
      targetId: publishedField.id,
      detail: {
        entityCode: field.entity.entityCode,
        fieldCode: publishedField.fieldCode,
        version: publishedField.version,
        note: input.payload.note?.trim() || null
      }
    });

    return {
      ok: true,
      message: `字段 ${publishedField.fieldCode} 已发布。`
    };
  }

  const reason = input.payload.reason?.trim() ?? "";

  if (!snapshotId) {
    return {
      ok: false,
      message: "缺少目标快照 ID。"
    };
  }

  if (!reason) {
    return {
      ok: false,
      message: "执行字段回滚时必须填写回滚原因。"
    };
  }

  const snapshot = await prisma.metaConfigSnapshot.findUnique({
    where: {
      id: snapshotId
    }
  });

  if (!snapshot || snapshot.targetType !== "FIELD_META" || snapshot.targetId !== field.id) {
    return {
      ok: false,
      message: "目标字段快照不存在。"
    };
  }

  const parsedSnapshot = parseFieldSnapshot(snapshot.snapshot);

  if (!parsedSnapshot) {
    return {
      ok: false,
      message: "字段快照内容已损坏，无法回滚。"
    };
  }

  const targetEntity = await prisma.entityMeta.findUnique({
    where: {
      id: parsedSnapshot.entityId
    }
  });

  if (!targetEntity) {
    return {
      ok: false,
      message: "字段快照对应的实体不存在，无法回滚。"
    };
  }

  const duplicate = await prisma.fieldMeta.findFirst({
    where: {
      entityId: parsedSnapshot.entityId,
      fieldCode: parsedSnapshot.fieldCode,
      NOT: {
        id: field.id
      }
    }
  });

  if (duplicate) {
    return {
      ok: false,
      message: `实体 ${targetEntity.entityCode} 下已存在字段编码 ${parsedSnapshot.fieldCode}，无法回滚。`
    };
  }

  const nextVersion = field.version + 1;
  const rolledBackField = await prisma.fieldMeta.update({
    where: {
      id: field.id
    },
    data: {
      entityId: parsedSnapshot.entityId,
      fieldCode: parsedSnapshot.fieldCode,
      name: parsedSnapshot.name,
      type: parsedSnapshot.type,
      status: parsedSnapshot.status,
      version: nextVersion,
      required: parsedSnapshot.required,
      schema: parsedSnapshot.schema
    }
  });

  await createMetaSnapshot({
    targetType: "FIELD_META",
    targetId: rolledBackField.id,
    targetCode: rolledBackField.fieldCode,
    entityId: rolledBackField.entityId,
    fieldId: rolledBackField.id,
    status: rolledBackField.status,
    action: "META_FIELD_ROLLED_BACK",
    note: reason,
    snapshot: buildFieldSnapshotPayload(rolledBackField),
    operatorId: input.session.userId,
    version: rolledBackField.version
  });

  await createAuditLog({
    operatorId: input.session.userId,
    action: "META_FIELD_ROLLED_BACK",
    targetType: "FIELD_META",
    targetId: rolledBackField.id,
    detail: {
      entityCode: targetEntity.entityCode,
      fieldCode: rolledBackField.fieldCode,
      fromSnapshotVersion: snapshot.version,
      toVersion: rolledBackField.version,
      reason
    }
  });

  return {
    ok: true,
    message: `字段 ${rolledBackField.fieldCode} 已回滚到快照 v${snapshot.version}。`
  };
}

export async function performMetaPageAction(
  input: MetaPageActionInput
): Promise<ActionResult> {
  if (!hasPermission(input.session, "meta:manage")) {
    return {
      ok: false,
      message: "当前账号没有管理低代码配置的权限。"
    };
  }

  const id = input.payload.id?.trim() ?? "";
  const entityId = input.payload.entityId?.trim() ?? "";
  const pageCode = input.payload.pageCode?.trim() ?? "";
  const pageType = input.payload.pageType?.trim() ?? "";
  const version = Number(input.payload.version);
  const status = input.payload.status;

  if (input.action === "delete") {
    if (!id) {
      return {
        ok: false,
        message: "缺少待删除的页面配置 ID。"
      };
    }

    const page = await prisma.pageMeta.findUnique({
      where: {
        id
      },
      include: {
        entity: true
      }
    });

    if (!page) {
      return {
        ok: false,
        message: "目标页面配置不存在。"
      };
    }

    await prisma.pageMeta.delete({
      where: {
        id
      }
    });

    await createAuditLog({
      operatorId: input.session.userId,
      action: "META_PAGE_DELETED",
      targetType: "PAGE_META",
      targetId: page.id,
      detail: {
        entityCode: page.entity.entityCode,
        pageCode: page.pageCode,
        version: page.version
      }
    });

    return {
      ok: true,
      message: `页面配置 ${page.pageCode} v${page.version} 已删除。`
    };
  }

  const schemaResult = parseSchemaText(input.payload.schemaText ?? "", true);

  if (!schemaResult.ok || !schemaResult.provided) {
    return {
      ok: false,
      message: schemaResult.ok ? "Schema 不能为空。" : schemaResult.message
    };
  }

  const pageSchema = schemaResult.value as Prisma.InputJsonValue;

  if (
    !entityId ||
    !pageCode ||
    !validatePageCode(pageCode) ||
    !pageType ||
    !Number.isInteger(version) ||
    version < 1 ||
    !status ||
    !isValidRecordStatus(status)
  ) {
    return {
      ok: false,
      message: "请完整填写实体、页面编码、页面类型、版本和状态；页面编码需为小写字母、数字和下划线。"
    };
  }

  const entity = await prisma.entityMeta.findUnique({
    where: {
      id: entityId
    }
  });

  if (!entity) {
    return {
      ok: false,
      message: "所选实体不存在。"
    };
  }

  if (input.action === "create") {
    const duplicate = await prisma.pageMeta.findFirst({
      where: {
        entityId,
        pageCode,
        version
      }
    });

    if (duplicate) {
      return {
        ok: false,
        message: `实体 ${entity.entityCode} 下已存在 ${pageCode} v${version}。`
      };
    }

    const page = await prisma.pageMeta.create({
      data: {
        entityId,
        pageCode,
        pageType,
        version,
        status,
        schema: pageSchema
      }
    });

    await createAuditLog({
      operatorId: input.session.userId,
      action: "META_PAGE_CREATED",
      targetType: "PAGE_META",
      targetId: page.id,
      detail: {
        entityCode: entity.entityCode,
        pageCode,
        pageType,
        version,
        status
      }
    });

    return {
      ok: true,
      message: `页面配置 ${pageCode} v${version} 已创建。`
    };
  }

  if (!id) {
    return {
      ok: false,
      message: "缺少待更新的页面配置 ID。"
    };
  }

  const page = await prisma.pageMeta.findUnique({
    where: {
      id
    },
    include: {
      entity: true
    }
  });

  if (!page) {
    return {
      ok: false,
      message: "目标页面配置不存在。"
    };
  }

  const duplicate = await prisma.pageMeta.findFirst({
    where: {
      entityId,
      pageCode,
      version,
      NOT: {
        id
      }
    }
  });

  if (duplicate) {
    return {
      ok: false,
      message: `实体 ${entity.entityCode} 下已有相同页面编码和版本。`
    };
  }

  await prisma.pageMeta.update({
    where: {
      id
    },
    data: {
      entityId,
      pageCode,
      pageType,
      version,
      status,
      schema: pageSchema
    }
  });

  await createAuditLog({
    operatorId: input.session.userId,
    action: "META_PAGE_UPDATED",
    targetType: "PAGE_META",
    targetId: page.id,
    detail: {
      beforeEntityCode: page.entity.entityCode,
      afterEntityCode: entity.entityCode,
      beforePageCode: page.pageCode,
      afterPageCode: pageCode,
      beforeVersion: page.version,
      afterVersion: version
    }
  });

  return {
    ok: true,
    message: `页面配置 ${pageCode} v${version} 已更新。`
  };
}

export async function performMetaPageVersionAction(
  input: MetaPageVersionActionInput
): Promise<ActionResult> {
  if (!hasPermission(input.session, "meta:manage")) {
    return {
      ok: false,
      message: "当前账号没有管理低代码配置的权限。"
    };
  }

  const pageId = input.payload.pageId?.trim() ?? "";

  if (!pageId) {
    return {
      ok: false,
      message: "缺少目标页面配置 ID。"
    };
  }

  const page = await prisma.pageMeta.findUnique({
    where: {
      id: pageId
    },
    include: {
      entity: true
    }
  });

  if (!page) {
    return {
      ok: false,
      message: "目标页面配置不存在。"
    };
  }

  const fieldCount = await prisma.fieldMeta.count({
    where: {
      entityId: page.entityId
    }
  });

  if (fieldCount === 0) {
    return {
      ok: false,
      message: `实体 ${page.entity.entityCode} 还没有字段配置，不能执行页面发布治理操作。`
    };
  }

  if (page.entity.status === RecordStatus.DISABLED) {
    return {
      ok: false,
      message: `实体 ${page.entity.entityCode} 当前已停用，不能发布或回滚页面版本。`
    };
  }

  if (input.action === "clone-version") {
    const existingVersions = await prisma.pageMeta.findMany({
      where: {
        entityId: page.entityId,
        pageCode: page.pageCode
      },
      orderBy: {
        version: "desc"
      }
    });
    const nextVersion =
      input.payload.targetVersion && Number.isInteger(input.payload.targetVersion)
        ? input.payload.targetVersion
        : (existingVersions[0]?.version ?? page.version) + 1;

    if (!Number.isInteger(nextVersion) || nextVersion <= 0) {
      return {
        ok: false,
        message: "新版本号必须是大于 0 的整数。"
      };
    }

    const duplicateVersion = existingVersions.find((item) => item.version === nextVersion);

    if (duplicateVersion) {
      return {
        ok: false,
        message: `版本 v${nextVersion} 已存在，请使用新的版本号。`
      };
    }

    const clonedPage = await prisma.pageMeta.create({
      data: {
        entityId: page.entityId,
        pageCode: page.pageCode,
        pageType: page.pageType,
        version: nextVersion,
        status: RecordStatus.DRAFT,
        schema: page.schema as Prisma.InputJsonValue
      }
    });

    await createAuditLog({
      operatorId: input.session.userId,
      action: "META_PAGE_VERSION_CLONED",
      targetType: "PAGE_META",
      targetId: clonedPage.id,
      detail: {
        entityCode: page.entity.entityCode,
        pageCode: page.pageCode,
        sourceVersion: page.version,
        targetVersion: nextVersion,
        note: input.payload.note?.trim() || null
      }
    });

    return {
      ok: true,
      message: `已从 ${page.pageCode} v${page.version} 克隆出新版本 v${nextVersion}。`
    };
  }

  const publishedPage = await prisma.pageMeta.findFirst({
    where: {
      entityId: page.entityId,
      pageCode: page.pageCode,
      status: RecordStatus.PUBLISHED
    },
    orderBy: {
      version: "desc"
    }
  });

  if (input.action === "publish") {
    if (page.status === RecordStatus.PUBLISHED) {
      return {
        ok: true,
        message: `${page.pageCode} v${page.version} 当前已经是发布版本。`
      };
    }

    await prisma.$transaction(async (tx) => {
      if (publishedPage && publishedPage.id !== page.id) {
        await tx.pageMeta.update({
          where: {
            id: publishedPage.id
          },
          data: {
            status: RecordStatus.DISABLED
          }
        });
      }

      await tx.pageMeta.update({
        where: {
          id: page.id
        },
        data: {
          status: RecordStatus.PUBLISHED
        }
      });
    });

    if (page.entity.status !== RecordStatus.PUBLISHED) {
      await prisma.entityMeta.update({
        where: {
          id: page.entityId
        },
        data: {
          status: RecordStatus.PUBLISHED
        }
      });

      await createAuditLog({
        operatorId: input.session.userId,
        action: "META_ENTITY_PUBLISHED",
        targetType: "ENTITY_META",
        targetId: page.entityId,
        detail: {
          entityCode: page.entity.entityCode,
          source: "page-publish"
        }
      });
    }

    await createAuditLog({
      operatorId: input.session.userId,
      action: "META_PAGE_PUBLISHED",
      targetType: "PAGE_META",
      targetId: page.id,
      detail: {
        entityCode: page.entity.entityCode,
        pageCode: page.pageCode,
        version: page.version,
        previousPublishedVersion: publishedPage?.version ?? null,
        note: input.payload.note?.trim() || null
      }
    });

    return {
      ok: true,
      message: `${page.pageCode} v${page.version} 已发布。`
    };
  }

  const reason = input.payload.reason?.trim() ?? "";

  if (!reason) {
    return {
      ok: false,
      message: "执行回滚时必须填写回滚原因。"
    };
  }

  if (publishedPage?.id === page.id) {
    return {
      ok: false,
      message: `${page.pageCode} v${page.version} 已经是当前发布版本。`
    };
  }

  await prisma.$transaction(async (tx) => {
    if (publishedPage) {
      await tx.pageMeta.update({
        where: {
          id: publishedPage.id
        },
        data: {
          status: RecordStatus.DISABLED
        }
      });
    }

    await tx.pageMeta.update({
      where: {
        id: page.id
      },
      data: {
        status: RecordStatus.PUBLISHED
      }
    });
  });

  if (page.entity.status !== RecordStatus.PUBLISHED) {
    await prisma.entityMeta.update({
      where: {
        id: page.entityId
      },
      data: {
        status: RecordStatus.PUBLISHED
      }
    });

    await createAuditLog({
      operatorId: input.session.userId,
      action: "META_ENTITY_PUBLISHED",
      targetType: "ENTITY_META",
      targetId: page.entityId,
      detail: {
        entityCode: page.entity.entityCode,
        source: "page-rollback"
      }
    });
  }

  await createAuditLog({
    operatorId: input.session.userId,
    action: "META_PAGE_ROLLED_BACK",
    targetType: "PAGE_META",
    targetId: page.id,
    detail: {
      entityCode: page.entity.entityCode,
      pageCode: page.pageCode,
      fromVersion: publishedPage?.version ?? null,
      toVersion: page.version,
      reason
    }
  });

  return {
    ok: true,
    message: `已回滚到 ${page.pageCode} v${page.version}。`
  };
}
