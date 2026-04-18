import { Prisma, RecordStatus } from "@prisma/client";
import type { OrderListItem, OrderRecord } from "@/features/orders/data/mock-orders";
import { prisma } from "@/lib/db/prisma";

type RuntimeSourceStatus = "RESOLVED" | "FALLBACK" | "MISSING";

type RuntimeConfig = {
  path?: string;
  strategy?: string;
  fallback?: Prisma.JsonValue;
};

type RuntimeOrderContext = Pick<
  OrderListItem,
  | "id"
  | "orderNo"
  | "sourceChannel"
  | "customerName"
  | "phone"
  | "customerLevel"
  | "status"
  | "warehouseName"
  | "amount"
  | "tags"
  | "createdAt"
> &
  Partial<Pick<OrderRecord, "notes">>;

type PublishedFieldDefinition = {
  fieldCode: string;
  name: string;
  type: string;
  required: boolean;
  schema: Prisma.JsonValue | null;
};

type PublishedRuntimePageResult =
  | {
      ok: false;
      entityCode: string;
      pageCode: string;
      message: string;
      warnings: string[];
    }
  | {
      ok: true;
      entityCode: string;
      entityName: string;
      entityVersion: number;
      pageCode: string;
      pageType: string;
      pageVersion: number;
      pageSchema: Prisma.JsonValue;
      declaredCodes: string[];
      warnings: string[];
      fieldsByCode: Map<string, PublishedFieldDefinition>;
    };

export type MetaRuntimeField = {
  fieldCode: string;
  name: string;
  type: string;
  required: boolean;
  description: string | null;
  sourceLabel: string;
  sourceStatus: RuntimeSourceStatus;
  displayValue: string;
};

export type MetaRuntimeFieldGroup = {
  key: string;
  title: string;
  description: string | null;
  fields: MetaRuntimeField[];
};

export type MetaRuntimeListCell = {
  displayValue: string;
  sourceLabel: string;
  sourceStatus: RuntimeSourceStatus;
};

export type MetaRuntimeListColumn = {
  fieldCode: string;
  name: string;
  type: string;
  description: string | null;
  cellsByOrderId: Record<string, MetaRuntimeListCell>;
};

export type MetaRuntimePageResult =
  | {
      ok: false;
      entityCode: string;
      pageCode: string;
      message: string;
      warnings: string[];
      groups: [];
    }
  | {
      ok: true;
      entityCode: string;
      entityName: string;
      entityVersion: number;
      pageCode: string;
      pageType: string;
      pageVersion: number;
      message: string;
      warnings: string[];
      fieldCount: number;
      groups: MetaRuntimeFieldGroup[];
    };

export type MetaRuntimeListResult =
  | {
      ok: false;
      entityCode: string;
      pageCode: string;
      message: string;
      warnings: string[];
      columns: [];
    }
  | {
      ok: true;
      entityCode: string;
      entityName: string;
      entityVersion: number;
      pageCode: string;
      pageType: string;
      pageVersion: number;
      configuredColumnCount: number;
      builtinColumnCount: number;
      activeColumnCount: number;
      builtinColumnCodes: string[];
      message: string;
      warnings: string[];
      columns: MetaRuntimeListColumn[];
    };

const builtinListColumnCodes = new Set([
  "orderNo",
  "status",
  "sourceChannel",
  "customerName",
  "phone",
  "customerLevel",
  "warehouseName",
  "amount",
  "createdAt"
]);

const defaultRuntimeConfigByField: Record<string, RuntimeConfig> = {
  delivery_priority: {
    path: "tags",
    strategy: "delivery_priority_from_tags",
    fallback: "normal"
  },
  review_note: {
    path: "notes.service"
  }
};

function isJsonRecord(value: Prisma.JsonValue | null | undefined): value is Prisma.JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(value: Prisma.JsonValue | null | undefined) {
  return typeof value === "string" ? value : null;
}

function getStringArray(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function getValueByPath(source: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, source);
}

function deriveDeliveryPriority(order: RuntimeOrderContext, input: unknown) {
  const tags = Array.isArray(input)
    ? input.filter((item): item is string => typeof item === "string")
    : [];

  if (tags.some((tag) => ["加急", "极速发货", "优先履约"].includes(tag))) {
    return "urgent";
  }

  if (
    tags.some((tag) => ["VIP", "高价值", "会员优先"].includes(tag)) ||
    order.customerLevel.includes("会员") ||
    order.customerLevel.toUpperCase().includes("VIP")
  ) {
    return "vip";
  }

  return "normal";
}

function normalizeRuntimeConfig(fieldCode: string, schema: Prisma.JsonValue | null) {
  if (!isJsonRecord(schema)) {
    return defaultRuntimeConfigByField[fieldCode] ?? {};
  }

  const runtimeValue = schema.runtime;
  if (!isJsonRecord(runtimeValue)) {
    return defaultRuntimeConfigByField[fieldCode] ?? {};
  }

  return {
    path: getString(runtimeValue.path) ?? defaultRuntimeConfigByField[fieldCode]?.path,
    strategy:
      getString(runtimeValue.strategy) ?? defaultRuntimeConfigByField[fieldCode]?.strategy,
    fallback:
      runtimeValue.fallback !== undefined
        ? runtimeValue.fallback
        : defaultRuntimeConfigByField[fieldCode]?.fallback
  } satisfies RuntimeConfig;
}

function getOptionDisplayMap(schema: Prisma.JsonValue | null) {
  const optionMap: Record<string, string> = {};

  if (!isJsonRecord(schema)) {
    return optionMap;
  }

  if (isJsonRecord(schema.optionLabels)) {
    for (const [key, value] of Object.entries(schema.optionLabels)) {
      if (typeof value === "string") {
        optionMap[key] = value;
      }
    }
  }

  if (Array.isArray(schema.options)) {
    for (const item of schema.options) {
      if (typeof item === "string") {
        optionMap[item] ??= item;
      } else if (isJsonRecord(item)) {
        const value = getString(item.value);
        const label = getString(item.label);

        if (value && label) {
          optionMap[value] = label;
        }
      }
    }
  }

  return optionMap;
}

function formatDisplayValue(
  value: Prisma.JsonValue | null | undefined,
  optionMap: Record<string, string>
): string {
  if (value === null || value === undefined || value === "") {
    return "未配置";
  }

  if (typeof value === "string") {
    return optionMap[value] ?? value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => formatDisplayValue(item, optionMap))
      .filter((item) => item !== "未配置")
      .join(" / ");
  }

  return JSON.stringify(value);
}

function resolveFieldValue(
  order: RuntimeOrderContext,
  fieldCode: string,
  schema: Prisma.JsonValue | null
) {
  const runtimeConfig = normalizeRuntimeConfig(fieldCode, schema);
  const sourcePath = runtimeConfig.path ?? null;
  const strategy = runtimeConfig.strategy ?? null;
  const optionMap = getOptionDisplayMap(schema);
  const rawInput = sourcePath ? getValueByPath(order, sourcePath) : undefined;

  let value: Prisma.JsonValue | undefined =
    rawInput === undefined ? undefined : (rawInput as Prisma.JsonValue);
  let sourceStatus: RuntimeSourceStatus = "RESOLVED";

  if (strategy === "delivery_priority_from_tags") {
    value = deriveDeliveryPriority(order, rawInput) as Prisma.JsonValue;
  }

  if (
    (value === undefined || value === null || value === "") &&
    runtimeConfig.fallback !== undefined
  ) {
    value = runtimeConfig.fallback;
    sourceStatus = "FALLBACK";
  }

  if (value === undefined || value === null || value === "") {
    sourceStatus = "MISSING";
  }

  const sourceSummary = [
    sourcePath ? `来源 ${sourcePath}` : "默认映射",
    strategy ? `策略 ${strategy}` : null,
    sourceStatus === "FALLBACK" ? "已应用默认值" : null,
    sourceStatus === "MISSING" ? "暂无值" : null
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    displayValue: formatDisplayValue(value, optionMap),
    sourceLabel: sourceSummary,
    sourceStatus
  };
}

function buildRuntimeField(
  order: RuntimeOrderContext,
  field: PublishedFieldDefinition
): MetaRuntimeField {
  const config = resolveFieldValue(order, field.fieldCode, field.schema);
  const schema = isJsonRecord(field.schema) ? field.schema : null;

  return {
    fieldCode: field.fieldCode,
    name: field.name,
    type: field.type,
    required: field.required,
    description: getString(schema?.description) ?? getString(schema?.placeholder) ?? null,
    sourceLabel: config.sourceLabel,
    sourceStatus: config.sourceStatus,
    displayValue: config.displayValue
  };
}

function collectDeclaredCodes(schema: Prisma.JsonValue) {
  if (!isJsonRecord(schema)) {
    return [];
  }

  const codes = new Set<string>([
    ...getStringArray(schema.fields),
    ...getStringArray(schema.columns)
  ]);
  const groups = Array.isArray(schema.groups) ? schema.groups : [];

  for (const group of groups) {
    if (!isJsonRecord(group)) {
      continue;
    }

    for (const fieldCode of getStringArray(group.fields)) {
      codes.add(fieldCode);
    }
  }

  return Array.from(codes);
}

function collectListColumns(schema: Prisma.JsonValue) {
  if (!isJsonRecord(schema)) {
    return [];
  }

  return getStringArray(schema.columns);
}

function buildGroups(
  pageSchema: Prisma.JsonValue,
  fieldsByCode: Map<string, MetaRuntimeField>
) {
  const fallbackFields = collectDeclaredCodes(pageSchema)
    .map((fieldCode) => fieldsByCode.get(fieldCode))
    .filter((field): field is MetaRuntimeField => Boolean(field));

  if (!isJsonRecord(pageSchema) || !Array.isArray(pageSchema.groups)) {
    return fallbackFields.length > 0
      ? [
          {
            key: "default",
            title: "扩展字段",
            description: "按已发布页面配置渲染。",
            fields: fallbackFields
          }
        ]
      : [];
  }

  const configuredGroups = pageSchema.groups
    .map((group, index) => {
      if (!isJsonRecord(group)) {
        return null;
      }

      const groupFields = getStringArray(group.fields)
        .map((fieldCode) => fieldsByCode.get(fieldCode))
        .filter((field): field is MetaRuntimeField => Boolean(field));

      if (groupFields.length === 0) {
        return null;
      }

      return {
        key: getString(group.key) ?? `group-${index + 1}`,
        title: getString(group.title) ?? `扩展分组 ${index + 1}`,
        description: getString(group.description),
        fields: groupFields
      } satisfies MetaRuntimeFieldGroup;
    })
    .filter((group): group is MetaRuntimeFieldGroup => Boolean(group));

  return configuredGroups.length > 0
    ? configuredGroups
    : fallbackFields.length > 0
      ? [
          {
            key: "default",
            title: "扩展字段",
            description: "按已发布页面配置渲染。",
            fields: fallbackFields
          }
        ]
      : [];
}

async function resolvePublishedOrderExtensionPage(
  pageCode: string
): Promise<PublishedRuntimePageResult> {
  try {
    const entity = await prisma.entityMeta.findFirst({
      where: {
        entityCode: "ORDER_EXTENSION",
        status: RecordStatus.PUBLISHED
      }
    });

    if (!entity) {
      return {
        ok: false,
        entityCode: "ORDER_EXTENSION",
        pageCode,
        message: "当前还没有已发布的订单扩展实体配置。",
        warnings: []
      };
    }

    const [page, fields] = await Promise.all([
      prisma.pageMeta.findFirst({
        where: {
          entityId: entity.id,
          pageCode,
          status: RecordStatus.PUBLISHED
        },
        orderBy: {
          version: "desc"
        }
      }),
      prisma.fieldMeta.findMany({
        where: {
          entityId: entity.id,
          status: RecordStatus.PUBLISHED
        },
        orderBy: {
          createdAt: "asc"
        }
      })
    ]);

    if (!page) {
      return {
        ok: false,
        entityCode: entity.entityCode,
        pageCode,
        message: `当前还没有已发布的 ${pageCode} 页面配置。`,
        warnings: []
      };
    }

    const declaredCodes = collectDeclaredCodes(page.schema);
    const fieldsByCode = new Map(
      fields.map((field) => [
        field.fieldCode,
        {
          fieldCode: field.fieldCode,
          name: field.name,
          type: field.type,
          required: field.required,
          schema: field.schema
        } satisfies PublishedFieldDefinition
      ])
    );

    const warnings = declaredCodes
      .filter((code) => !builtinListColumnCodes.has(code) && !fieldsByCode.has(code))
      .map((code) => `字段 ${code} 当前未发布，运行时已自动忽略。`);

    return {
      ok: true,
      entityCode: entity.entityCode,
      entityName: entity.name,
      entityVersion: entity.version,
      pageCode: page.pageCode,
      pageType: page.pageType,
      pageVersion: page.version,
      pageSchema: page.schema,
      declaredCodes,
      warnings,
      fieldsByCode
    };
  } catch {
    return {
      ok: false,
      entityCode: "ORDER_EXTENSION",
      pageCode,
      message: "当前无法读取低代码运行时配置，请先确认 Prisma 数据源可用。",
      warnings: []
    };
  }
}

export async function getOrderExtensionDetailRuntime(
  order: OrderRecord
): Promise<MetaRuntimePageResult> {
  const page = await resolvePublishedOrderExtensionPage("order_extension_detail");

  if (!page.ok) {
    return {
      ok: false,
      entityCode: page.entityCode,
      pageCode: page.pageCode,
      message: page.message,
      warnings: page.warnings,
      groups: []
    };
  }

  const declaredFieldCodes = page.declaredCodes.filter((code) => page.fieldsByCode.has(code));
  if (declaredFieldCodes.length === 0) {
    return {
      ok: false,
      entityCode: page.entityCode,
      pageCode: page.pageCode,
      message: "已发布页面配置没有声明可渲染的扩展字段。",
      warnings: page.warnings,
      groups: []
    };
  }

  const runtimeFields = new Map(
    declaredFieldCodes.map((fieldCode) => {
      const field = page.fieldsByCode.get(fieldCode);

      return [
        fieldCode,
        buildRuntimeField(order, field as PublishedFieldDefinition)
      ];
    })
  );
  const groups = buildGroups(page.pageSchema, runtimeFields);

  if (groups.length === 0) {
    return {
      ok: false,
      entityCode: page.entityCode,
      pageCode: page.pageCode,
      message: "当前页面引用的字段没有可生效的已发布版本。",
      warnings: page.warnings,
      groups: []
    };
  }

  const fieldCount = groups.reduce((count, group) => count + group.fields.length, 0);

  return {
    ok: true,
    entityCode: page.entityCode,
    entityName: page.entityName,
    entityVersion: page.entityVersion,
    pageCode: page.pageCode,
    pageType: page.pageType,
    pageVersion: page.pageVersion,
    fieldCount,
    message: "当前只读取实体、字段和页面的已发布版本，草稿配置不会影响订单详情页。",
    warnings: page.warnings,
    groups
  };
}

export async function getOrderExtensionListRuntime(
  orders: RuntimeOrderContext[]
): Promise<MetaRuntimeListResult> {
  const page = await resolvePublishedOrderExtensionPage("order_extension_list");

  if (!page.ok) {
    return {
      ok: false,
      entityCode: page.entityCode,
      pageCode: page.pageCode,
      message: page.message,
      warnings: page.warnings,
      columns: []
    };
  }

  const configuredColumns = collectListColumns(page.pageSchema);
  const builtinColumnCodes = configuredColumns.filter((code) => builtinListColumnCodes.has(code));
  const extensionColumns = configuredColumns
    .filter((code) => !builtinListColumnCodes.has(code))
    .map((fieldCode) => {
      const field = page.fieldsByCode.get(fieldCode);

      if (!field) {
        return null;
      }

      return {
        fieldCode,
        name: field.name,
        type: field.type,
        description: getString(isJsonRecord(field.schema) ? field.schema.description : null),
        cellsByOrderId: Object.fromEntries(
          orders.map((order) => {
            const cell = buildRuntimeField(order, field);

            return [
              order.id,
              {
                displayValue: cell.displayValue,
                sourceLabel: cell.sourceLabel,
                sourceStatus: cell.sourceStatus
              } satisfies MetaRuntimeListCell
            ];
          })
        )
      } satisfies MetaRuntimeListColumn;
    })
    .filter((column): column is MetaRuntimeListColumn => Boolean(column));

  return {
    ok: true,
    entityCode: page.entityCode,
    entityName: page.entityName,
    entityVersion: page.entityVersion,
    pageCode: page.pageCode,
    pageType: page.pageType,
    pageVersion: page.pageVersion,
    configuredColumnCount: configuredColumns.length,
    builtinColumnCount: builtinColumnCodes.length,
    activeColumnCount: extensionColumns.length,
    builtinColumnCodes,
    message:
      extensionColumns.length > 0
        ? "订单工作台当前已按已发布列表页配置加载扩展列，草稿列表页版本不会直接影响线上展示。"
        : "当前已发布列表页只包含基础列，或引用的扩展字段尚未发布。",
    warnings: page.warnings,
    columns: extensionColumns
  };
}
