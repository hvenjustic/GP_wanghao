import {
  ruleComparisonOperatorValues,
  ruleExpressionGroupCombinators,
  ruleExpressionKinds
} from "@/features/rules/lib/rule-expression";

export const ruleScenes = [
  {
    scene: "订单创建后",
    goal: "自动审核、锁单、打标签",
    priority: "P0"
  },
  {
    scene: "审核通过后",
    goal: "自动分仓、设置履约优先级",
    priority: "P0"
  },
  {
    scene: "发货前校验",
    goal: "检查物流参数、补充备注、阻断异常发货",
    priority: "P1"
  },
  {
    scene: "人工重跑",
    goal: "修正规则后重新评估存量订单",
    priority: "P1"
  }
] as const;

export const ruleTypeOptions = [
  "ORDER_REVIEW",
  "WAREHOUSE_ASSIGN",
  "SHIPMENT_CHECK",
  "MANUAL_RETRY"
] as const;

export const ruleNodeTypes = [
  "开始节点",
  "条件节点",
  "分支节点",
  "动作节点",
  "结果节点",
  "计算节点"
] as const;

export const ruleNodeTemplates = [
  {
    kind: "start",
    label: "开始节点",
    detail: "定义规则触发场景和输入上下文。"
  },
  {
    kind: "condition",
    label: "条件节点",
    detail: "按订单字段、标签、金额或地址进行条件判断。"
  },
  {
    kind: "branch",
    label: "分支节点",
    detail: "把条件结果拆到不同路径。"
  },
  {
    kind: "action",
    label: "动作节点",
    detail: "执行锁单、打标、改状态、分仓等动作。"
  },
  {
    kind: "result",
    label: "结果节点",
    detail: "输出通过、转人工、拦截等最终结果。"
  },
  {
    kind: "compute",
    label: "计算节点",
    detail: "做权重、优先级和中间变量计算。"
  }
] as const;

export const ruleFieldOptions = [
  "orderNo",
  "sourceChannel",
  "customerLevel",
  "delivery_priority",
  "amount",
  "paymentStatus",
  "status",
  "isLocked",
  "isAbnormal",
  "tags",
  "warehouseCode",
  "receiver.province",
  "receiver.city",
  "receiver.address",
  "notes.buyer",
  "payload.shippingCompany",
  "payload.trackingNo"
] as const;

export const ruleConditionOperators = [
  {
    value: "eq",
    label: "等于",
    description: "字段值与预期值完全相等。"
  },
  {
    value: "neq",
    label: "不等于",
    description: "字段值与预期值不相等。"
  },
  {
    value: "gt",
    label: "大于",
    description: "适用于金额、数量、优先级等数值字段。"
  },
  {
    value: "gte",
    label: "大于等于",
    description: "适用于金额、数量、优先级等数值字段。"
  },
  {
    value: "lt",
    label: "小于",
    description: "适用于金额、数量、优先级等数值字段。"
  },
  {
    value: "lte",
    label: "小于等于",
    description: "适用于金额、数量、优先级等数值字段。"
  },
  {
    value: "includes",
    label: "包含",
    description: "适用于数组字段或文本片段匹配。"
  },
  {
    value: "notIncludes",
    label: "不包含",
    description: "适用于数组字段或文本片段排除。"
  },
  {
    value: "startsWith",
    label: "前缀匹配",
    description: "适用于单号、编码和文本前缀。"
  },
  {
    value: "endsWith",
    label: "后缀匹配",
    description: "适用于单号、编码和文本后缀。"
  },
  {
    value: "oneOf",
    label: "属于集合",
    description: "字段值命中给定数组中的任一值。"
  },
  {
    value: "exists",
    label: "有值",
    description: "字段不为空且不为 null。"
  }
] as const satisfies ReadonlyArray<{
  value: (typeof ruleComparisonOperatorValues)[number];
  label: string;
  description: string;
}>;

export const ruleExpressionTypeOptions = [
  {
    value: "comparison",
    label: "比较表达式",
    description: "单字段比较，适合大多数基础判断场景。"
  },
  {
    value: "group",
    label: "组合表达式",
    description: "通过 and / or 把多个子表达式组合成复杂条件。"
  },
  {
    value: "not",
    label: "取反表达式",
    description: "对某个子表达式取反，适合表达“不是某值”一类条件。"
  }
] as const satisfies ReadonlyArray<{
  value: (typeof ruleExpressionKinds)[number];
  label: string;
  description: string;
}>;

export const ruleExpressionGroupOptions = [
  {
    value: "and",
    label: "全部满足",
    description: "所有子表达式都命中才算命中。"
  },
  {
    value: "or",
    label: "任一满足",
    description: "只要任一子表达式命中就算命中。"
  }
] as const satisfies ReadonlyArray<{
  value: (typeof ruleExpressionGroupCombinators)[number];
  label: string;
  description: string;
}>;

export const ruleActionOptions = [
  {
    value: "approve-review",
    label: "自动审核通过",
    description: "把订单推进到待分仓，并清理锁单/异常标记。"
  },
  {
    value: "assign-warehouse",
    label: "自动分仓",
    description: "按指定仓或区域优先级自动分配履约仓。"
  },
  {
    value: "lock-order",
    label: "自动锁单",
    description: "阻断当前链路，并把订单转入人工处理。"
  },
  {
    value: "mark-abnormal",
    label: "标记异常",
    description: "给订单打上异常态，便于人工排查。"
  },
  {
    value: "append-tag",
    label: "追加标签",
    description: "向订单标签集中追加业务标签。"
  },
  {
    value: "set-review-mode",
    label: "设置审核模式",
    description: "更新订单当前审核处理说明。"
  },
  {
    value: "set-note",
    label: "更新系统备注",
    description: "把规则命中原因写入系统备注。"
  }
] as const;

export const ruleNodeConfigTemplates = {
  start: {
    scene: "订单创建后",
    description: "开始节点通常不参与判断，只用于描述当前场景。"
  },
  condition: {
    expression: {
      type: "comparison",
      field: "amount",
      operator: "lte",
      value: 300
    }
  },
  branch: {
    branches: [
      {
        label: "命中高风险路径",
        target: "result-high-risk",
        expression: {
          type: "comparison",
          field: "amount",
          operator: "gt",
          value: 500
        }
      },
      {
        label: "进入默认放行路径",
        target: "result-pass"
      }
    ],
    defaultTarget: "result-pass"
  },
  action: {
    actions: [
      {
        action: "approve-review",
        note: "规则自动审核通过，订单进入待分仓。",
        stopProcessing: true
      }
    ]
  },
  result: {
    result: "自动审核通过"
  },
  compute: {
    description: "计算节点用于承载中间变量、权重和优先级计算。"
  }
} as const;

export const ruleNodeConfigSemantics = {
  start: [
    "用于声明当前规则绑定的触发场景和输入说明，通常不参与条件判断。",
    "推荐字段：`scene`、`description`。"
  ],
  condition: [
    "条件节点优先按 `expression` 解释，支持 `comparison / group / not` 三种表达式类型。",
    "为兼容旧规则，运行时仍接受扁平的 `field + operator + value` 写法，但新规则应统一迁移到 `expression` 结构。",
    "字段路径支持订单主字段、嵌套对象字段和动作入参字段，例如 `tags`、`receiver.city`、`payload.shippingCompany`。"
  ],
  branch: [
    "分支节点按 `branches` 顺序求值，首个命中的分支会决定后续运行路径。",
    "每个 `branches[].target` 都必须指向当前分支节点已连接的下游节点 ID，推荐把最后一个无表达式分支作为兜底路径。",
    "若所有显式分支都未命中，则优先走 `defaultTarget`；未配置时才退回首条连线。"
  ],
  action: [
    "动作节点支持单动作对象，或 `actions` 数组串联多个动作。",
    "动作会直接驱动锁单、审核、分仓、备注、标签等订单状态变化。"
  ],
  result: [
    "结果节点用于输出最终业务结论，便于日志和试运行结果展示。",
    "推荐字段：`result`、`decision`、`description`。"
  ],
  compute: [
    "计算节点用于描述变量计算和中间结果处理。",
    "可用于整理评分、优先级和聚合结果。"
  ]
} as const;

export const ruleExpressionExamples = {
  comparison: {
    type: "comparison",
    field: "amount",
    operator: "lte",
    value: 300
  },
  group: {
    type: "group",
    combinator: "and",
    expressions: [
      {
        type: "comparison",
        field: "delivery_priority",
        operator: "eq",
        value: "urgent"
      },
      {
        type: "comparison",
        field: "payload.shippingCompany",
        operator: "neq",
        value: "顺丰速运"
      }
    ]
  },
  not: {
    type: "not",
    expression: {
      type: "comparison",
      field: "isLocked",
      operator: "eq",
      value: true
    }
  }
} as const;
