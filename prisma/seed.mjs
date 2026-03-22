import { PrismaClient, Prisma } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");

  return `${salt}:${derivedKey}`;
}

const permissionDefinitions = [
  { id: "perm-dashboard-view", code: "dashboard:view", name: "查看项目总览", scope: "dashboard" },
  { id: "perm-orders-view", code: "orders:view", name: "查看订单", scope: "orders" },
  { id: "perm-orders-review", code: "orders:review", name: "审核订单", scope: "orders" },
  {
    id: "perm-orders-assign-warehouse",
    code: "orders:assign-warehouse",
    name: "分配仓库",
    scope: "orders"
  },
  { id: "perm-orders-ship", code: "orders:ship", name: "订单发货", scope: "orders" },
  { id: "perm-users-view", code: "users:view", name: "查看用户权限", scope: "users" },
  { id: "perm-users-manage", code: "users:manage", name: "管理用户权限", scope: "users" },
  { id: "perm-meta-view", code: "meta:view", name: "查看低代码配置", scope: "meta" },
  { id: "perm-meta-manage", code: "meta:manage", name: "管理低代码配置", scope: "meta" },
  { id: "perm-rules-view", code: "rules:view", name: "查看规则编排", scope: "rules" },
  { id: "perm-rules-manage", code: "rules:manage", name: "管理规则编排", scope: "rules" }
];

const roleDefinitions = [
  { id: "role-admin", code: "ADMIN", name: "管理员", status: "ACTIVE" },
  { id: "role-operator", code: "OPERATOR", name: "运营人员", status: "ACTIVE" },
  { id: "role-auditor", code: "AUDITOR", name: "审核人员", status: "ACTIVE" },
  { id: "role-configurator", code: "CONFIGURATOR", name: "配置人员", status: "ACTIVE" }
];

const rolePermissionMappings = [
  ["role-admin", "perm-dashboard-view"],
  ["role-admin", "perm-orders-view"],
  ["role-admin", "perm-orders-review"],
  ["role-admin", "perm-orders-assign-warehouse"],
  ["role-admin", "perm-orders-ship"],
  ["role-admin", "perm-users-view"],
  ["role-admin", "perm-users-manage"],
  ["role-admin", "perm-meta-view"],
  ["role-admin", "perm-meta-manage"],
  ["role-admin", "perm-rules-view"],
  ["role-admin", "perm-rules-manage"],
  ["role-operator", "perm-dashboard-view"],
  ["role-operator", "perm-orders-view"],
  ["role-operator", "perm-orders-review"],
  ["role-operator", "perm-orders-assign-warehouse"],
  ["role-operator", "perm-orders-ship"],
  ["role-auditor", "perm-dashboard-view"],
  ["role-auditor", "perm-orders-view"],
  ["role-auditor", "perm-orders-review"],
  ["role-configurator", "perm-dashboard-view"],
  ["role-configurator", "perm-meta-view"],
  ["role-configurator", "perm-meta-manage"],
  ["role-configurator", "perm-rules-view"],
  ["role-configurator", "perm-rules-manage"]
];

const demoUsers = [
  {
    id: "demo-admin",
    email: "admin@gp.local",
    name: "系统管理员",
    passwordHash: hashPassword("Admin123!"),
    status: "ACTIVE"
  },
  {
    id: "demo-ops",
    email: "ops@gp.local",
    name: "订单运营",
    passwordHash: hashPassword("Ops123!"),
    status: "ACTIVE"
  },
  {
    id: "demo-auditor",
    email: "audit@gp.local",
    name: "审核专员",
    passwordHash: hashPassword("Audit123!"),
    status: "ACTIVE"
  },
  {
    id: "demo-config",
    email: "config@gp.local",
    name: "配置实施",
    passwordHash: hashPassword("Config123!"),
    status: "ACTIVE"
  }
];

const userRoleMappings = [
  ["demo-admin", "role-admin"],
  ["demo-ops", "role-operator"],
  ["demo-auditor", "role-auditor"],
  ["demo-config", "role-configurator"]
];

const warehouses = [
  { id: "warehouse-east-01", code: "WH-EAST-01", name: "华东一仓", region: "华东", priority: 10 },
  { id: "warehouse-south-02", code: "WH-SOUTH-02", name: "华南二仓", region: "华南", priority: 8 },
  { id: "warehouse-north-01", code: "WH-NORTH-01", name: "华北仓", region: "华北", priority: 7 }
];

const customers = [
  { id: "customer-001", name: "张小雨", phone: "13800001234", level: "新客" },
  { id: "customer-002", name: "王晨", phone: "13900004567", level: "老客" },
  { id: "customer-003", name: "李青", phone: "13700007890", level: "新客" },
  { id: "customer-004", name: "陈思远", phone: "13600005555", level: "会员" }
];

const entityMetas = [
  {
    id: "entity-meta-order-extension",
    entityCode: "ORDER_EXTENSION",
    name: "订单扩展模型",
    type: "ORDER_EXTENSION",
    status: "PUBLISHED",
    schema: {
      owner: "订单中台",
      source: "prisma",
      editable: true
    }
  },
  {
    id: "entity-meta-customer-profile",
    entityCode: "CUSTOMER_PROFILE",
    name: "客户画像模型",
    type: "CUSTOMER_EXTENSION",
    status: "DRAFT",
    schema: {
      owner: "运营团队",
      editable: true,
      notes: "用于承接客户标签与分层字段"
    }
  }
];

const fieldMetas = [
  {
    id: "field-meta-delivery-priority",
    entityId: "entity-meta-order-extension",
    fieldCode: "delivery_priority",
    name: "履约优先级",
    type: "select",
    required: false,
    schema: {
      options: ["normal", "urgent", "vip"],
      listVisible: true,
      detailVisible: true
    }
  },
  {
    id: "field-meta-review-note",
    entityId: "entity-meta-order-extension",
    fieldCode: "review_note",
    name: "审核备注",
    type: "text",
    required: false,
    schema: {
      maxLength: 200,
      formVisible: true,
      placeholder: "请输入审核补充说明"
    }
  },
  {
    id: "field-meta-customer-level-tag",
    entityId: "entity-meta-customer-profile",
    fieldCode: "customer_level_tag",
    name: "客户等级标签",
    type: "select",
    required: false,
    schema: {
      options: ["new", "returning", "vip"],
      searchVisible: true
    }
  }
];

const pageMetas = [
  {
    id: "page-meta-order-extension-list-v1",
    entityId: "entity-meta-order-extension",
    pageCode: "order_extension_list",
    pageType: "list",
    version: 1,
    status: "PUBLISHED",
    schema: {
      columns: ["orderNo", "delivery_priority", "review_note"],
      actions: ["view", "edit"],
      searchFields: ["orderNo", "delivery_priority"]
    }
  },
  {
    id: "page-meta-order-extension-list-v2",
    entityId: "entity-meta-order-extension",
    pageCode: "order_extension_list",
    pageType: "list",
    version: 2,
    status: "DRAFT",
    schema: {
      columns: ["orderNo", "delivery_priority", "review_note", "status"],
      actions: ["view", "edit", "publish"],
      searchFields: ["orderNo", "delivery_priority", "status"]
    }
  },
  {
    id: "page-meta-order-extension-detail-v1",
    entityId: "entity-meta-order-extension",
    pageCode: "order_extension_detail",
    pageType: "detail",
    version: 1,
    status: "DRAFT",
    schema: {
      groups: ["基础信息", "审核信息"],
      fields: ["delivery_priority", "review_note"]
    }
  },
  {
    id: "page-meta-customer-profile-form-v1",
    entityId: "entity-meta-customer-profile",
    pageCode: "customer_profile_form",
    pageType: "form",
    version: 1,
    status: "DRAFT",
    schema: {
      fields: ["customer_level_tag"],
      submitAction: "saveDraft"
    }
  }
];

const ruleDefinitions = [
  {
    id: "rule-def-base-review",
    ruleCode: "RULE_BASE_REVIEW",
    name: "订单基础审核",
    type: "ORDER_REVIEW",
    scene: "订单创建后",
    status: "PUBLISHED"
  },
  {
    id: "rule-def-address-risk",
    ruleCode: "RULE_ADDRESS_RISK",
    name: "地址风险识别",
    type: "ORDER_REVIEW",
    scene: "订单创建后",
    status: "PUBLISHED"
  },
  {
    id: "rule-def-auto-approve",
    ruleCode: "RULE_AUTO_APPROVE",
    name: "自动审核规则",
    type: "ORDER_REVIEW",
    scene: "订单创建后",
    status: "PUBLISHED"
  },
  {
    id: "rule-def-warehouse-priority",
    ruleCode: "RULE_WAREHOUSE_PRIORITY",
    name: "分仓优先级规则",
    type: "WAREHOUSE_ASSIGN",
    scene: "审核通过后",
    status: "PUBLISHED"
  }
];

const ruleVersions = [
  {
    id: "rule-ver-base-review-v12",
    ruleId: "rule-def-base-review",
    version: 12,
    graph: {
      nodes: ["开始", "信息完整", "低风险", "进入待审核"],
      edges: 3
    },
    publishInfo: {
      publishedBy: "系统管理员",
      publishedAt: "2026-03-21 20:30"
    }
  },
  {
    id: "rule-ver-address-risk-v20",
    ruleId: "rule-def-address-risk",
    version: 20,
    graph: {
      nodes: ["开始", "地址异常", "锁单", "人工复核"],
      edges: 3
    },
    publishInfo: {
      publishedBy: "配置实施",
      publishedAt: "2026-03-21 21:10"
    }
  },
  {
    id: "rule-ver-auto-approve-v15",
    ruleId: "rule-def-auto-approve",
    version: 15,
    graph: {
      nodes: ["开始", "低风险", "自动通过"],
      edges: 2
    },
    publishInfo: {
      publishedBy: "配置实施",
      publishedAt: "2026-03-21 21:35"
    }
  },
  {
    id: "rule-ver-warehouse-priority-v11",
    ruleId: "rule-def-warehouse-priority",
    version: 11,
    graph: {
      nodes: ["开始", "区域判断", "优先级排序", "返回仓库"],
      edges: 3
    },
    publishInfo: {
      publishedBy: "系统管理员",
      publishedAt: "2026-03-22 08:50"
    }
  }
];

const ruleExecLogs = [
  {
    id: "rule-log-001",
    ruleVersionId: "rule-ver-base-review-v12",
    orderId: "order-001",
    scene: "订单创建后",
    status: "SUCCESS",
    durationMs: 84,
    input: {
      orderNo: "GP202603220001",
      amount: 328,
      tags: ["首单", "高客单"]
    },
    result: {
      decision: "MANUAL_REVIEW",
      path: "开始 -> 信息完整 -> 低风险 -> 待人工确认",
      reason: "自动审核入参完整"
    },
    createdAt: "2026-03-22T09:16:00.000Z"
  },
  {
    id: "rule-log-002",
    ruleVersionId: "rule-ver-address-risk-v20",
    orderId: "order-002",
    scene: "订单创建后",
    status: "BLOCKED",
    durationMs: 126,
    input: {
      orderNo: "GP202603220002",
      receiverCity: "苏州市",
      riskReason: "楼栋信息缺失"
    },
    result: {
      decision: "LOCK_ORDER",
      abnormal: true,
      nextStatus: "MANUAL_REVIEW"
    },
    createdAt: "2026-03-22T09:44:00.000Z"
  },
  {
    id: "rule-log-003",
    ruleVersionId: "rule-ver-auto-approve-v15",
    orderId: "order-003",
    scene: "订单创建后",
    status: "SUCCESS",
    durationMs: 71,
    input: {
      orderNo: "GP202603220003",
      amount: 256,
      channel: "微信小店"
    },
    result: {
      decision: "APPROVED",
      nextStatus: "PENDING_WAREHOUSE",
      path: "开始 -> 低风险 -> 自动通过"
    },
    createdAt: "2026-03-22T10:09:00.000Z"
  },
  {
    id: "rule-log-004",
    ruleVersionId: "rule-ver-warehouse-priority-v11",
    orderId: "order-004",
    scene: "审核通过后",
    status: "SUCCESS",
    durationMs: 93,
    input: {
      orderNo: "GP202603220004",
      receiverProvince: "浙江省",
      receiverCity: "宁波市"
    },
    result: {
      assignedWarehouse: "WH-EAST-01",
      path: "开始 -> 华东区域 -> 华东一仓"
    },
    createdAt: "2026-03-22T10:23:00.000Z"
  }
];

const auditLogs = [
  {
    id: "audit-log-001",
    operatorId: "demo-admin",
    action: "USER_LOGIN",
    targetType: "SESSION",
    targetId: "demo-admin",
    detail: {
      email: "admin@gp.local",
      result: "SUCCESS"
    },
    createdAt: "2026-03-22T08:55:00.000Z"
  },
  {
    id: "audit-log-002",
    operatorId: "demo-admin",
    action: "ROLE_PERMISSIONS_UPDATED",
    targetType: "ROLE",
    targetId: "role-operator",
    detail: {
      roleCode: "OPERATOR",
      permissionCount: 4
    },
    createdAt: "2026-03-22T09:05:00.000Z"
  },
  {
    id: "audit-log-003",
    operatorId: "demo-ops",
    action: "ORDER_ACTION_EXECUTED",
    targetType: "ORDER",
    targetId: "order-003",
    detail: {
      orderNo: "GP202603220003",
      action: "assign-warehouse",
      nextStatus: "PENDING_SHIPMENT"
    },
    createdAt: "2026-03-22T10:11:00.000Z"
  },
  {
    id: "audit-log-004",
    operatorId: "demo-admin",
    action: "USER_PASSWORD_RESET",
    targetType: "USER",
    targetId: "demo-ops",
    detail: {
      email: "ops@gp.local"
    },
    createdAt: "2026-03-22T10:35:00.000Z"
  },
  {
    id: "audit-log-005",
    operatorId: "demo-admin",
    action: "USER_STATUS_UPDATED",
    targetType: "USER",
    targetId: "demo-auditor",
    detail: {
      email: "audit@gp.local",
      beforeStatus: "ACTIVE",
      afterStatus: "ACTIVE"
    },
    createdAt: "2026-03-22T11:10:00.000Z"
  },
  {
    id: "audit-log-006",
    operatorId: "demo-config",
    action: "META_PAGE_VERSION_CLONED",
    targetType: "PAGE_META",
    targetId: "page-meta-order-extension-list-v2",
    detail: {
      entityCode: "ORDER_EXTENSION",
      pageCode: "order_extension_list",
      sourceVersion: 1,
      targetVersion: 2,
      note: "为发版前预演新增版本"
    },
    createdAt: "2026-03-22T11:20:00.000Z"
  },
  {
    id: "audit-log-007",
    operatorId: "demo-config",
    action: "META_ENTITY_PUBLISHED",
    targetType: "ENTITY_META",
    targetId: "entity-meta-order-extension",
    detail: {
      entityCode: "ORDER_EXTENSION",
      status: "PUBLISHED"
    },
    createdAt: "2026-03-22T11:22:00.000Z"
  },
  {
    id: "audit-log-008",
    operatorId: "demo-config",
    action: "META_PAGE_PUBLISHED",
    targetType: "PAGE_META",
    targetId: "page-meta-order-extension-list-v1",
    detail: {
      entityCode: "ORDER_EXTENSION",
      pageCode: "order_extension_list",
      version: 1,
      previousPublishedVersion: null
    },
    createdAt: "2026-03-22T11:24:00.000Z"
  }
];

const orders = [
  {
    id: "order-001",
    orderNo: "GP202603220001",
    sourceNo: "DY0001",
    sourceChannel: "抖音小店",
    status: "PENDING_REVIEW",
    isLocked: false,
    isAbnormal: false,
    reviewMode: "自动审核",
    amount: 328,
    customerId: "customer-001",
    warehouseId: null,
    extension: {
      tags: ["首单", "高客单"],
      receiver: {
        receiverName: "张小雨",
        phone: "13800001234",
        province: "浙江省",
        city: "杭州市",
        district: "滨江区",
        address: "长河街道江南大道 88 号"
      },
      amountSummary: {
        goodsAmount: 308,
        discountAmount: 10,
        shippingFee: 30,
        paidAmount: 328
      },
      notes: {
        buyer: "希望尽快发货",
        service: "首单用户，可重点关注签收体验",
        system: "命中自动审核入参完整规则"
      },
      ruleHits: [
        {
          id: "rule-hit-001",
          ruleName: "订单基础审核",
          version: "v1.2",
          path: "开始 -> 信息完整 -> 低风险 -> 待人工确认",
          result: "进入待审核",
          executedAt: "2026-03-22 09:16"
        }
      ]
    },
    items: [
      {
        skuId: "SKU-A100",
        skuName: "便携收纳箱",
        spec: "奶油白 / 36L",
        quantity: 2,
        price: 129
      },
      {
        skuId: "SKU-A208",
        skuName: "抽屉分隔板",
        spec: "4 片装",
        quantity: 1,
        price: 50
      }
    ],
    operationLogs: [
      {
        type: "SYSTEM",
        action: "ORDER_IMPORTED",
        title: "订单导入",
        detail: "订单从抖音小店导入系统。",
        operatorName: "系统",
        createdAt: "2026-03-22T09:15:00.000Z"
      },
      {
        type: "RULE",
        action: "RULE_EXECUTED",
        title: "规则试跑完成",
        detail: "命中订单基础审核规则，当前进入待审核。",
        operatorName: "规则引擎",
        createdAt: "2026-03-22T09:16:00.000Z"
      }
    ]
  },
  {
    id: "order-002",
    orderNo: "GP202603220002",
    sourceNo: "TB0002",
    sourceChannel: "淘宝",
    status: "MANUAL_REVIEW",
    isLocked: true,
    isAbnormal: true,
    reviewMode: "人工审核",
    amount: 1120,
    customerId: "customer-002",
    warehouseId: null,
    extension: {
      tags: ["地址待确认", "人工复核"],
      receiver: {
        receiverName: "王晨",
        phone: "13900004567",
        province: "江苏省",
        city: "苏州市",
        district: "吴中区",
        address: "木渎镇花苑街 16 号"
      },
      amountSummary: {
        goodsAmount: 1090,
        discountAmount: 20,
        shippingFee: 50,
        paidAmount: 1120
      },
      notes: {
        buyer: "请周末送达",
        service: "地址存在楼栋缺失，需客服回访确认。",
        system: "高风险地址命中锁单规则"
      },
      ruleHits: [
        {
          id: "rule-hit-002",
          ruleName: "地址风险识别",
          version: "v2.0",
          path: "开始 -> 地址异常 -> 锁单 -> 人工复核",
          result: "自动锁单并进入人工审核",
          executedAt: "2026-03-22 09:44"
        }
      ]
    },
    items: [
      {
        skuId: "SKU-B100",
        skuName: "无线吸尘器",
        spec: "旗舰版",
        quantity: 1,
        price: 1120
      }
    ],
    operationLogs: [
      {
        type: "SYSTEM",
        action: "ORDER_IMPORTED",
        title: "订单导入",
        detail: "订单从淘宝导入系统。",
        operatorName: "系统",
        createdAt: "2026-03-22T09:42:00.000Z"
      },
      {
        type: "RULE",
        action: "RISK_LOCKED",
        title: "命中地址异常规则",
        detail: "订单被自动锁单并转人工审核。",
        operatorName: "规则引擎",
        createdAt: "2026-03-22T09:44:00.000Z"
      }
    ]
  },
  {
    id: "order-003",
    orderNo: "GP202603220003",
    sourceNo: "WX0003",
    sourceChannel: "微信小店",
    status: "PENDING_WAREHOUSE",
    isLocked: false,
    isAbnormal: false,
    reviewMode: "自动审核",
    amount: 256,
    customerId: "customer-003",
    warehouseId: null,
    extension: {
      tags: ["自动审核通过"],
      receiver: {
        receiverName: "李青",
        phone: "13700007890",
        province: "上海市",
        city: "上海市",
        district: "浦东新区",
        address: "张江高科技园区科苑路 66 号"
      },
      amountSummary: {
        goodsAmount: 236,
        discountAmount: 0,
        shippingFee: 20,
        paidAmount: 256
      },
      notes: {
        buyer: "",
        service: "可优先分配华东仓。",
        system: "自动审核通过，等待分仓"
      },
      ruleHits: [
        {
          id: "rule-hit-003",
          ruleName: "自动审核规则",
          version: "v1.5",
          path: "开始 -> 低风险 -> 自动通过",
          result: "进入待分仓",
          executedAt: "2026-03-22 10:09"
        }
      ]
    },
    items: [
      {
        skuId: "SKU-C100",
        skuName: "真空保温杯",
        spec: "星夜黑 / 500ml",
        quantity: 2,
        price: 118
      }
    ],
    operationLogs: [
      {
        type: "RULE",
        action: "AUTO_APPROVED",
        title: "审核通过",
        detail: "自动审核后进入待分仓。",
        operatorName: "规则引擎",
        createdAt: "2026-03-22T10:09:00.000Z"
      }
    ]
  },
  {
    id: "order-004",
    orderNo: "GP202603220004",
    sourceNo: "DY0004",
    sourceChannel: "抖音小店",
    status: "PENDING_SHIPMENT",
    isLocked: false,
    isAbnormal: false,
    reviewMode: "自动审核",
    amount: 486,
    customerId: "customer-004",
    warehouseId: "warehouse-east-01",
    extension: {
      tags: ["加急"],
      receiver: {
        receiverName: "陈思远",
        phone: "13600005555",
        province: "浙江省",
        city: "宁波市",
        district: "鄞州区",
        address: "首南街道天童南路 520 号"
      },
      amountSummary: {
        goodsAmount: 456,
        discountAmount: 10,
        shippingFee: 40,
        paidAmount: 486
      },
      notes: {
        buyer: "麻烦加固包装",
        service: "高优先级订单，尽快发货。",
        system: "已完成自动分仓"
      },
      ruleHits: [
        {
          id: "rule-hit-004",
          ruleName: "分仓优先级规则",
          version: "v1.1",
          path: "开始 -> 华东区域 -> 华东一仓",
          result: "分配华东一仓",
          executedAt: "2026-03-22 10:23"
        }
      ]
    },
    items: [
      {
        skuId: "SKU-D100",
        skuName: "极简落地灯",
        spec: "暖光版",
        quantity: 1,
        price: 456
      }
    ],
    operationLogs: [
      {
        type: "RULE",
        action: "WAREHOUSE_ASSIGNED",
        title: "自动分仓",
        detail: "系统根据区域和仓优先级分配至华东一仓。",
        operatorName: "规则引擎",
        createdAt: "2026-03-22T10:23:00.000Z"
      }
    ]
  }
];

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.ruleExecLog.deleteMany();
  await prisma.ruleVersion.deleteMany();
  await prisma.ruleDefinition.deleteMany();
  await prisma.pageMeta.deleteMany();
  await prisma.fieldMeta.deleteMany();
  await prisma.entityMeta.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.orderOperationLog.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.user.deleteMany();

  await prisma.permission.createMany({ data: permissionDefinitions });
  await prisma.role.createMany({ data: roleDefinitions });
  await prisma.user.createMany({ data: demoUsers });
  await prisma.warehouse.createMany({ data: warehouses });
  await prisma.customer.createMany({ data: customers });
  await prisma.entityMeta.createMany({ data: entityMetas });
  await prisma.fieldMeta.createMany({ data: fieldMetas });
  await prisma.pageMeta.createMany({ data: pageMetas });
  await prisma.rolePermission.createMany({
    data: rolePermissionMappings.map(([roleId, permissionId]) => ({
      roleId,
      permissionId
    }))
  });
  await prisma.userRole.createMany({
    data: userRoleMappings.map(([userId, roleId]) => ({
      userId,
      roleId
    }))
  });
  await prisma.ruleDefinition.createMany({ data: ruleDefinitions });
  await prisma.ruleVersion.createMany({ data: ruleVersions });

  for (const order of orders) {
    await prisma.order.create({
      data: {
        id: order.id,
        orderNo: order.orderNo,
        sourceNo: order.sourceNo,
        sourceChannel: order.sourceChannel,
        status: order.status,
        isLocked: order.isLocked,
        isAbnormal: order.isAbnormal,
        reviewMode: order.reviewMode,
        amount: new Prisma.Decimal(order.amount),
        customerId: order.customerId,
        warehouseId: order.warehouseId,
        extension: order.extension,
        items: {
          create: order.items.map((item) => ({
            skuId: item.skuId,
            skuName: item.skuName,
            spec: item.spec,
            quantity: item.quantity,
            price: new Prisma.Decimal(item.price)
          }))
        },
        operationLogs: {
          create: order.operationLogs.map((log) => ({
            type: log.type,
            action: log.action,
            title: log.title,
            detail: log.detail,
            operatorName: log.operatorName,
            createdAt: new Date(log.createdAt)
          }))
        }
      }
    });
  }

  await prisma.ruleExecLog.createMany({
    data: ruleExecLogs.map((log) => ({
      ...log,
      createdAt: new Date(log.createdAt)
    }))
  });
  await prisma.auditLog.createMany({
    data: auditLogs.map((log) => ({
      ...log,
      createdAt: new Date(log.createdAt)
    }))
  });

  console.log("Seed completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
