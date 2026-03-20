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

export const ruleNodeTypes = [
  "开始节点",
  "条件节点",
  "分支节点",
  "动作节点",
  "结果节点",
  "计算节点"
] as const;
