export const metaCapabilities = [
  {
    title: "实体建模",
    description: "定义订单、客户、仓库和扩展实体，约束哪些对象可被页面和规则引用。"
  },
  {
    title: "字段治理",
    description: "统一字段编码、校验、显示条件和依赖分析，避免配置失控。"
  },
  {
    title: "页面 Schema",
    description: "把列表、表单、详情页统一收敛为结构化配置，由渲染层解释执行。"
  },
  {
    title: "动作配置",
    description: "控制行操作、批量操作和高风险按钮的显示条件与权限码。"
  },
  {
    title: "预览发布",
    description: "支持草稿、预览、发布、停用和历史版本回滚。"
  },
  {
    title: "依赖分析",
    description: "查看字段和页面被哪些规则、导入模板或组件引用。"
  }
] as const;
