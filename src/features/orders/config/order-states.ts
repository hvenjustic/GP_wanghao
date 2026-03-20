export const orderStates = [
  {
    name: "待审核",
    code: "PENDING_REVIEW",
    tone: "blue",
    description: "订单进入系统后的默认状态，等待审核规则和人工确认。"
  },
  {
    name: "人工审核",
    code: "MANUAL_REVIEW",
    tone: "amber",
    description: "命中高风险条件或信息不完整，需要人工处理。"
  },
  {
    name: "待分仓",
    code: "PENDING_WAREHOUSE",
    tone: "blue",
    description: "审核通过但尚未确定履约仓库。"
  },
  {
    name: "待发货",
    code: "PENDING_SHIPMENT",
    tone: "amber",
    description: "已完成分仓，待录入物流信息并执行发货。"
  },
  {
    name: "已发货",
    code: "SHIPPED",
    tone: "green",
    description: "物流公司和单号已落库，订单进入运输阶段。"
  },
  {
    name: "已取消",
    code: "CANCELED",
    tone: "red",
    description: "审核驳回或运营取消后结束处理。"
  }
] as const;
