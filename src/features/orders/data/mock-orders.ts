import type { OrderStatusCode } from "@/features/orders/config/order-states";

export type OrderListItem = {
  id: string;
  orderNo: string;
  sourceChannel: string;
  customerName: string;
  phone: string;
  customerLevel: string;
  status: OrderStatusCode;
  warehouseName: string | null;
  amount: number;
  tags: string[];
  createdAt: string;
  isAbnormal: boolean;
  isLocked: boolean;
  abnormalContext?: OrderAbnormalContext;
};

export type OrderLineItem = {
  id: string;
  skuId: string;
  skuName: string;
  spec: string;
  quantity: number;
  price: number;
};

export type OrderAmountSummary = {
  goodsAmount: number;
  discountAmount: number;
  shippingFee: number;
  paidAmount: number;
};

export type OrderReceiver = {
  receiverName: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  address: string;
};

export type OrderShipment = {
  companyCode: string;
  companyName: string;
  trackingNo: string;
  shippedAt: string | null;
};

export type OrderRuleHit = {
  id: string;
  ruleCode?: string;
  scene?: string;
  ruleName: string;
  version: string;
  path: string;
  result: string;
  decision?: string;
  executedAt: string;
};

export type OrderLogEntry = {
  id: string;
  type: "SYSTEM" | "MANUAL" | "RULE";
  title: string;
  detail: string;
  operator: string;
  createdAt: string;
};

export type OrderAbnormalContext = {
  currentReason?: string | null;
  currentSince?: string | null;
  currentOperator?: string | null;
  latestMarkedReason?: string | null;
  latestMarkedAt?: string | null;
  latestMarkedOperator?: string | null;
  latestResolvedReason?: string | null;
  latestResolvedAt?: string | null;
  latestResolvedOperator?: string | null;
  nextStep?: string | null;
  blockers?: string[];
  history?: OrderAbnormalHistoryEntry[];
};

export type OrderAbnormalHistoryEntry = {
  id: string;
  title: string;
  detail: string;
  operator: string;
  createdAt: string;
  status: "ACTIVE" | "RESOLVED" | "RULE";
};

export type OrderRecord = OrderListItem & {
  sourceNo: string;
  customerLevel: string;
  paymentStatus: string;
  reviewMode: string;
  warehouseCode: string | null;
  receiver: OrderReceiver;
  amountSummary: OrderAmountSummary;
  shipment: OrderShipment | null;
  items: OrderLineItem[];
  notes: {
    buyer: string;
    service: string;
    system: string;
  };
  ruleHits: OrderRuleHit[];
  logs: OrderLogEntry[];
  abnormalContext?: OrderAbnormalContext;
};

function createOrderLogEntry(
  id: string,
  type: OrderLogEntry["type"],
  title: string,
  detail: string,
  operator: string,
  createdAt: string
): OrderLogEntry {
  return {
    id,
    type,
    title,
    detail,
    operator,
    createdAt
  };
}

export const mockWarehouseCatalog = [
  { code: "WH-EAST-01", name: "华东一仓" },
  { code: "WH-SOUTH-02", name: "华南二仓" },
  { code: "WH-NORTH-01", name: "华北仓" }
] as const;

export function getInitialOrderRecords(): OrderRecord[] {
  return [
    {
      id: "order-001",
      orderNo: "GP202603220001",
      sourceNo: "DY0001",
      sourceChannel: "抖音小店",
      customerName: "张小雨",
      phone: "13800001234",
      customerLevel: "新客",
      paymentStatus: "已支付",
      reviewMode: "自动审核",
      status: "PENDING_REVIEW",
      warehouseCode: null,
      warehouseName: null,
      amount: 328,
      amountSummary: {
        goodsAmount: 308,
        discountAmount: 10,
        shippingFee: 30,
        paidAmount: 328
      },
      receiver: {
        receiverName: "张小雨",
        phone: "13800001234",
        province: "浙江省",
        city: "杭州市",
        district: "滨江区",
        address: "长河街道江南大道 88 号"
      },
      tags: ["首单", "高客单"],
      createdAt: "2026-03-22 09:15",
      isAbnormal: false,
      isLocked: false,
      shipment: null,
      items: [
        {
          id: "line-001-1",
          skuId: "SKU-A100",
          skuName: "便携收纳箱",
          spec: "奶油白 / 36L",
          quantity: 2,
          price: 129
        },
        {
          id: "line-001-2",
          skuId: "SKU-A208",
          skuName: "抽屉分隔板",
          spec: "4 片装",
          quantity: 1,
          price: 50
        }
      ],
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
      ],
      logs: [
        createOrderLogEntry(
          "log-001-1",
          "SYSTEM",
          "订单导入",
          "订单从抖音小店导入系统。",
          "系统",
          "2026-03-22 09:15"
        ),
        createOrderLogEntry(
          "log-001-2",
          "RULE",
          "规则试跑完成",
          "命中订单基础审核规则，当前进入待审核。",
          "规则引擎",
          "2026-03-22 09:16"
        )
      ]
    },
    {
      id: "order-002",
      orderNo: "GP202603220002",
      sourceNo: "TB0002",
      sourceChannel: "淘宝",
      customerName: "王晨",
      phone: "13900004567",
      customerLevel: "老客",
      paymentStatus: "已支付",
      reviewMode: "人工审核",
      status: "MANUAL_REVIEW",
      warehouseCode: null,
      warehouseName: null,
      amount: 1120,
      amountSummary: {
        goodsAmount: 1090,
        discountAmount: 20,
        shippingFee: 50,
        paidAmount: 1120
      },
      receiver: {
        receiverName: "王晨",
        phone: "13900004567",
        province: "江苏省",
        city: "苏州市",
        district: "吴中区",
        address: "木渎镇花苑街 16 号"
      },
      tags: ["地址待确认", "人工复核"],
      createdAt: "2026-03-22 09:42",
      isAbnormal: true,
      isLocked: true,
      shipment: null,
      items: [
        {
          id: "line-002-1",
          skuId: "SKU-B100",
          skuName: "无线吸尘器",
          spec: "旗舰版",
          quantity: 1,
          price: 1120
        }
      ],
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
      ],
      logs: [
        createOrderLogEntry(
          "log-002-1",
          "SYSTEM",
          "订单导入",
          "订单从淘宝导入系统。",
          "系统",
          "2026-03-22 09:42"
        ),
        createOrderLogEntry(
          "log-002-2",
          "RULE",
          "命中地址异常规则",
          "订单被自动锁单并转人工审核。",
          "规则引擎",
          "2026-03-22 09:44"
        )
      ]
    },
    {
      id: "order-003",
      orderNo: "GP202603220003",
      sourceNo: "WX0003",
      sourceChannel: "微信小店",
      customerName: "李青",
      phone: "13700007890",
      customerLevel: "新客",
      paymentStatus: "已支付",
      reviewMode: "自动审核",
      status: "PENDING_WAREHOUSE",
      warehouseCode: null,
      warehouseName: null,
      amount: 256,
      amountSummary: {
        goodsAmount: 236,
        discountAmount: 0,
        shippingFee: 20,
        paidAmount: 256
      },
      receiver: {
        receiverName: "李青",
        phone: "13700007890",
        province: "上海市",
        city: "上海市",
        district: "浦东新区",
        address: "张江高科技园区科苑路 66 号"
      },
      tags: ["自动审核通过"],
      createdAt: "2026-03-22 10:08",
      isAbnormal: false,
      isLocked: false,
      shipment: null,
      items: [
        {
          id: "line-003-1",
          skuId: "SKU-C100",
          skuName: "真空保温杯",
          spec: "星夜黑 / 500ml",
          quantity: 2,
          price: 118
        }
      ],
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
      ],
      logs: [
        createOrderLogEntry(
          "log-003-1",
          "SYSTEM",
          "订单创建",
          "微信小店订单进入系统。",
          "系统",
          "2026-03-22 10:08"
        ),
        createOrderLogEntry(
          "log-003-2",
          "RULE",
          "审核通过",
          "自动审核后进入待分仓。",
          "规则引擎",
          "2026-03-22 10:09"
        )
      ]
    },
    {
      id: "order-004",
      orderNo: "GP202603220004",
      sourceNo: "DY0004",
      sourceChannel: "抖音小店",
      customerName: "陈思远",
      phone: "13600005555",
      customerLevel: "会员",
      paymentStatus: "已支付",
      reviewMode: "自动审核",
      status: "PENDING_SHIPMENT",
      warehouseCode: "WH-EAST-01",
      warehouseName: "华东一仓",
      amount: 486,
      amountSummary: {
        goodsAmount: 456,
        discountAmount: 10,
        shippingFee: 40,
        paidAmount: 486
      },
      receiver: {
        receiverName: "陈思远",
        phone: "13600005555",
        province: "浙江省",
        city: "宁波市",
        district: "鄞州区",
        address: "首南街道天童南路 520 号"
      },
      tags: ["加急"],
      createdAt: "2026-03-22 10:20",
      isAbnormal: false,
      isLocked: false,
      shipment: null,
      items: [
        {
          id: "line-004-1",
          skuId: "SKU-D100",
          skuName: "极简落地灯",
          spec: "暖光版",
          quantity: 1,
          price: 456
        }
      ],
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
      ],
      logs: [
        createOrderLogEntry(
          "log-004-1",
          "RULE",
          "自动分仓",
          "系统根据区域和仓优先级分配至华东一仓。",
          "规则引擎",
          "2026-03-22 10:23"
        )
      ]
    },
    {
      id: "order-005",
      orderNo: "GP202603220005",
      sourceNo: "TB0005",
      sourceChannel: "淘宝",
      customerName: "赵妍",
      phone: "13500009999",
      customerLevel: "老客",
      paymentStatus: "已支付",
      reviewMode: "自动审核",
      status: "SHIPPED",
      warehouseCode: "WH-SOUTH-02",
      warehouseName: "华南二仓",
      amount: 699,
      amountSummary: {
        goodsAmount: 659,
        discountAmount: 0,
        shippingFee: 40,
        paidAmount: 699
      },
      receiver: {
        receiverName: "赵妍",
        phone: "13500009999",
        province: "广东省",
        city: "深圳市",
        district: "南山区",
        address: "科技园科发路 18 号"
      },
      tags: ["老客"],
      createdAt: "2026-03-22 10:56",
      isAbnormal: false,
      isLocked: false,
      shipment: {
        companyCode: "SF",
        companyName: "顺丰速运",
        trackingNo: "SF202603220005",
        shippedAt: "2026-03-22 13:40"
      },
      items: [
        {
          id: "line-005-1",
          skuId: "SKU-E100",
          skuName: "空气循环扇",
          spec: "标准款",
          quantity: 1,
          price: 699
        }
      ],
      notes: {
        buyer: "",
        service: "已发货，等待签收。",
        system: "物流信息已回写"
      },
      ruleHits: [
        {
          id: "rule-hit-005",
          ruleName: "老客快速通过规则",
          version: "v1.0",
          path: "开始 -> 老客 -> 自动通过",
          result: "订单优先处理",
          executedAt: "2026-03-22 10:58"
        }
      ],
      logs: [
        createOrderLogEntry(
          "log-005-1",
          "MANUAL",
          "手工发货",
          "运营录入顺丰单号并执行发货。",
          "订单运营",
          "2026-03-22 13:40"
        )
      ]
    },
    {
      id: "order-006",
      orderNo: "GP202603220006",
      sourceNo: "PDD0006",
      sourceChannel: "拼多多",
      customerName: "周琳",
      phone: "13400008888",
      customerLevel: "新客",
      paymentStatus: "已退款",
      reviewMode: "人工审核",
      status: "CANCELED",
      warehouseCode: null,
      warehouseName: null,
      amount: 88,
      amountSummary: {
        goodsAmount: 68,
        discountAmount: 0,
        shippingFee: 20,
        paidAmount: 88
      },
      receiver: {
        receiverName: "周琳",
        phone: "13400008888",
        province: "河南省",
        city: "郑州市",
        district: "金水区",
        address: "花园路 102 号"
      },
      tags: ["风控拦截"],
      createdAt: "2026-03-22 11:06",
      isAbnormal: true,
      isLocked: false,
      shipment: null,
      items: [
        {
          id: "line-006-1",
          skuId: "SKU-F100",
          skuName: "迷你香薰机",
          spec: "白色",
          quantity: 1,
          price: 88
        }
      ],
      notes: {
        buyer: "",
        service: "用户已申请退款。",
        system: "审核驳回后关闭订单"
      },
      ruleHits: [
        {
          id: "rule-hit-006",
          ruleName: "风险订单拦截",
          version: "v1.8",
          path: "开始 -> 命中黑名单 -> 驳回",
          result: "订单取消",
          executedAt: "2026-03-22 11:08"
        }
      ],
      logs: [
        createOrderLogEntry(
          "log-006-1",
          "MANUAL",
          "审核驳回",
          "命中风控规则，人工确认后取消订单。",
          "审核专员",
          "2026-03-22 11:10"
        )
      ]
    },
    {
      id: "order-007",
      orderNo: "GP202603220007",
      sourceNo: "WX0007",
      sourceChannel: "微信小店",
      customerName: "何远",
      phone: "13300007777",
      customerLevel: "新客",
      paymentStatus: "已支付",
      reviewMode: "待审核",
      status: "PENDING_REVIEW",
      warehouseCode: null,
      warehouseName: null,
      amount: 158,
      amountSummary: {
        goodsAmount: 138,
        discountAmount: 0,
        shippingFee: 20,
        paidAmount: 158
      },
      receiver: {
        receiverName: "何远",
        phone: "13300007777",
        province: "安徽省",
        city: "合肥市",
        district: "蜀山区",
        address: "长江西路 188 号"
      },
      tags: ["买家留言"],
      createdAt: "2026-03-22 11:18",
      isAbnormal: false,
      isLocked: false,
      shipment: null,
      items: [
        {
          id: "line-007-1",
          skuId: "SKU-G100",
          skuName: "桌面收纳架",
          spec: "胡桃木",
          quantity: 1,
          price: 158
        }
      ],
      notes: {
        buyer: "不要放快递柜",
        service: "需在发货备注中保留配送要求。",
        system: "待人工确认留言处理方式"
      },
      ruleHits: [
        {
          id: "rule-hit-007",
          ruleName: "留言识别规则",
          version: "v1.0",
          path: "开始 -> 有留言 -> 转待审核",
          result: "进入待审核",
          executedAt: "2026-03-22 11:19"
        }
      ],
      logs: [
        createOrderLogEntry(
          "log-007-1",
          "SYSTEM",
          "订单创建",
          "新订单待审核。",
          "系统",
          "2026-03-22 11:18"
        )
      ]
    },
    {
      id: "order-008",
      orderNo: "GP202603220008",
      sourceNo: "DY0008",
      sourceChannel: "抖音小店",
      customerName: "郑菲",
      phone: "13200006666",
      customerLevel: "高价值会员",
      paymentStatus: "已支付",
      reviewMode: "自动审核",
      status: "PENDING_SHIPMENT",
      warehouseCode: "WH-NORTH-01",
      warehouseName: "华北仓",
      amount: 950,
      amountSummary: {
        goodsAmount: 910,
        discountAmount: 0,
        shippingFee: 40,
        paidAmount: 950
      },
      receiver: {
        receiverName: "郑菲",
        phone: "13200006666",
        province: "北京市",
        city: "北京市",
        district: "朝阳区",
        address: "望京街道阜通东大街 9 号"
      },
      tags: ["直播专场", "高价值"],
      createdAt: "2026-03-22 11:46",
      isAbnormal: true,
      isLocked: false,
      shipment: null,
      items: [
        {
          id: "line-008-1",
          skuId: "SKU-H100",
          skuName: "高端护颈枕",
          spec: "石墨灰",
          quantity: 2,
          price: 475
        }
      ],
      notes: {
        buyer: "",
        service: "高价值订单，建议二次核验地址。",
        system: "分仓完成但保留异常标记"
      },
      ruleHits: [
        {
          id: "rule-hit-008",
          ruleName: "高价值订单复核规则",
          version: "v2.1",
          path: "开始 -> 高金额 -> 打标异常 -> 允许履约",
          result: "保留异常标签并进入待发货",
          executedAt: "2026-03-22 11:49"
        }
      ],
      logs: [
        createOrderLogEntry(
          "log-008-1",
          "RULE",
          "异常标记",
          "订单命中高价值复核规则，保留异常标签。",
          "规则引擎",
          "2026-03-22 11:49"
        )
      ]
    }
  ];
}
