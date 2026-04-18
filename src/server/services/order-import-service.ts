import { prisma } from "@/lib/db/prisma";
import { getInitialOrderRecords } from "@/features/orders/data/mock-orders";
import { orderStateMap } from "@/features/orders/config/order-states";

const orderImportTemplateHeaders = [
  "订单号",
  "来源渠道",
  "客户名",
  "手机号",
  "客户等级",
  "金额",
  "订单状态",
  "是否异常",
  "是否锁单",
  "仓库编码",
  "收件人",
  "收件手机号",
  "省",
  "市",
  "区",
  "详细地址",
  "标签"
] as const;

const importTemplateExampleRow = [
  "IMP202604170001",
  "抖音小店",
  "张测试",
  "13800000000",
  "新客",
  "199.00",
  "PENDING_REVIEW",
  "否",
  "否",
  "",
  "张测试",
  "13800000000",
  "浙江省",
  "杭州市",
  "滨江区",
  "网商路 699 号",
  "首单;导入测试"
];

type ImportTemplateHeader = (typeof orderImportTemplateHeaders)[number];

type OrderImportRow = Record<ImportTemplateHeader, string>;

export type OrderImportValidationItem = {
  rowNumber: number;
  orderNo: string;
  ok: boolean;
  message: string;
};

export type OrderImportValidationResult = {
  ok: boolean;
  message: string;
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
  };
  items: OrderImportValidationItem[];
};

function isPrismaOrderDataEnabled() {
  return process.env.ORDER_DATA_SOURCE === "prisma";
}

function escapeCsvValue(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replaceAll("\"", "\"\"")}"`;
  }

  return value;
}

function parseCsv(text: string) {
  const normalized = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let currentValue = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];

    if (inQuotes) {
      if (char === "\"") {
        if (normalized[index + 1] === "\"") {
          currentValue += "\"";
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentValue += char;
      }

      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if (char === "\n") {
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    currentValue += char;
  }

  if (currentValue || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows;
}

function isEmptyRow(row: string[]) {
  return row.every((cell) => cell.trim() === "");
}

function normalizeBooleanValue(value: string) {
  const normalized = value.trim();
  return ["", "否", "false", "0", "FALSE"].includes(normalized)
    ? { ok: true, value: false }
    : ["是", "true", "1", "TRUE"].includes(normalized)
      ? { ok: true, value: true }
      : { ok: false, value: false };
}

function mapRowToImportRecord(headerRow: string[], row: string[]) {
  return orderImportTemplateHeaders.reduce<OrderImportRow>((accumulator, header) => {
    const columnIndex = headerRow.indexOf(header);
    accumulator[header] = columnIndex >= 0 ? row[columnIndex]?.trim() ?? "" : "";
    return accumulator;
  }, {} as OrderImportRow);
}

async function getExistingOrderNos(orderNos: string[]) {
  if (orderNos.length === 0) {
    return new Set<string>();
  }

  if (!isPrismaOrderDataEnabled()) {
    return new Set(getInitialOrderRecords().map((item) => item.orderNo));
  }

  try {
    const existingRows = await prisma.order.findMany({
      where: {
        orderNo: {
          in: orderNos
        }
      },
      select: {
        orderNo: true
      }
    });

    return new Set(existingRows.map((item) => item.orderNo));
  } catch {
    return new Set(getInitialOrderRecords().map((item) => item.orderNo));
  }
}

export function buildOrderImportTemplateCsv() {
  const rows = [
    orderImportTemplateHeaders.map((item) => escapeCsvValue(item)).join(","),
    importTemplateExampleRow.map((item) => escapeCsvValue(item)).join(",")
  ].join("\n");

  return `\uFEFF${rows}`;
}

export async function validateOrderImportCsv(input: {
  fileName: string;
  content: string;
}): Promise<OrderImportValidationResult> {
  const fileName = input.fileName.trim();

  if (!fileName.toLowerCase().endsWith(".csv")) {
    return {
      ok: false,
      message: "仅支持上传 CSV 模板文件。",
      summary: {
        totalRows: 0,
        validRows: 0,
        invalidRows: 0
      },
      items: []
    };
  }

  const rows = parseCsv(input.content).filter((row) => !isEmptyRow(row));

  if (rows.length < 2) {
    return {
      ok: false,
      message: "导入文件缺少表头或示例数据，请先下载模板。",
      summary: {
        totalRows: 0,
        validRows: 0,
        invalidRows: 0
      },
      items: []
    };
  }

  const headerRow = rows[0]?.map((item) => item.trim()) ?? [];
  const missingHeaders = orderImportTemplateHeaders.filter(
    (header) => !headerRow.includes(header)
  );

  if (missingHeaders.length > 0) {
    return {
      ok: false,
      message: `模板缺少必要列：${missingHeaders.join("、")}。`,
      summary: {
        totalRows: 0,
        validRows: 0,
        invalidRows: 0
      },
      items: []
    };
  }

  const dataRows = rows.slice(1);

  if (dataRows.length > 200) {
    return {
      ok: false,
      message: "单次导入校验最多支持 200 行数据，请分批处理。",
      summary: {
        totalRows: dataRows.length,
        validRows: 0,
        invalidRows: dataRows.length
      },
      items: []
    };
  }

  const importRows = dataRows.map((row) => mapRowToImportRecord(headerRow, row));
  const existingOrderNos = await getExistingOrderNos(
    importRows.map((row) => row["订单号"]).filter(Boolean)
  );
  const seenOrderNos = new Set<string>();
  const statusCodes = Object.keys(orderStateMap);
  const items = importRows.map<OrderImportValidationItem>((row, index) => {
    const rowNumber = index + 2;
    const messages: string[] = [];
    const orderNo = row["订单号"];

    if (!orderNo) {
      messages.push("订单号不能为空");
    } else {
      if (!/^[A-Za-z0-9_-]{6,40}$/.test(orderNo)) {
        messages.push("订单号格式不合法");
      }
      if (seenOrderNos.has(orderNo)) {
        messages.push("模板内订单号重复");
      } else {
        seenOrderNos.add(orderNo);
      }
      if (existingOrderNos.has(orderNo)) {
        messages.push("订单号已存在");
      }
    }

    if (!row["来源渠道"]) {
      messages.push("来源渠道不能为空");
    }

    if (!row["客户名"]) {
      messages.push("客户名不能为空");
    }

    if (!/^1\d{10}$/.test(row["手机号"])) {
      messages.push("手机号格式不合法");
    }

    if (row["收件手机号"] && !/^1\d{10}$/.test(row["收件手机号"])) {
      messages.push("收件手机号格式不合法");
    }

    const amount = Number(row["金额"]);
    if (!row["金额"] || Number.isNaN(amount) || amount <= 0) {
      messages.push("金额必须是大于 0 的数字");
    }

    if (!statusCodes.includes(row["订单状态"])) {
      messages.push("订单状态必须使用系统状态编码");
    }

    const abnormalValue = normalizeBooleanValue(row["是否异常"]);
    if (!abnormalValue.ok) {
      messages.push("是否异常仅支持填写 是 / 否");
    }

    const lockedValue = normalizeBooleanValue(row["是否锁单"]);
    if (!lockedValue.ok) {
      messages.push("是否锁单仅支持填写 是 / 否");
    }

    if (!row["收件人"]) {
      messages.push("收件人不能为空");
    }

    if (!row["省"] || !row["市"] || !row["详细地址"]) {
      messages.push("收件地址信息不完整");
    }

    if (
      ["PENDING_SHIPMENT", "SHIPPED", "SIGNED", "COMPLETED"].includes(row["订单状态"]) &&
      !row["仓库编码"]
    ) {
      messages.push("待发货及后续状态必须填写仓库编码");
    }

    return {
      rowNumber,
      orderNo: orderNo || `第 ${rowNumber} 行`,
      ok: messages.length === 0,
      message:
        messages.length === 0
          ? "基础校验通过，当前版本可进入后续入库流程。"
          : messages.join("；")
    };
  });

  const validRows = items.filter((item) => item.ok).length;
  const invalidRows = items.length - validRows;

  return {
    ok: invalidRows === 0,
    message:
      invalidRows === 0
        ? `导入校验通过，共 ${items.length} 行。当前版本已完成模板和校验能力，暂不直接入库。`
        : `导入校验完成，共 ${items.length} 行，通过 ${validRows} 行，失败 ${invalidRows} 行。`,
    summary: {
      totalRows: items.length,
      validRows,
      invalidRows
    },
    items
  };
}
