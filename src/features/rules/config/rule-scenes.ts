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
