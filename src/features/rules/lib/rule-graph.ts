export const ruleNodeKinds = [
  "start",
  "condition",
  "branch",
  "action",
  "result",
  "compute"
] as const;

export type RuleNodeKind = (typeof ruleNodeKinds)[number];

type JsonPrimitive = string | number | boolean | null;
export type RuleJsonValue =
  | JsonPrimitive
  | RuleJsonValue[]
  | { [key: string]: RuleJsonValue };

export type RuleGraphNode = {
  id: string;
  position: {
    x: number;
    y: number;
  };
  data: {
    label: string;
    kind: RuleNodeKind;
    detail?: string;
    config?: RuleJsonValue;
  };
};

export type RuleGraphEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

export type RuleGraph = {
  nodes: RuleGraphNode[];
  edges: RuleGraphEdge[];
};

const kindLabelMap: Record<RuleNodeKind, string> = {
  start: "开始节点",
  condition: "条件节点",
  branch: "分支节点",
  action: "动作节点",
  result: "结果节点",
  compute: "计算节点"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toRuleNodeKind(value: unknown): RuleNodeKind {
  if (typeof value === "string" && ruleNodeKinds.includes(value as RuleNodeKind)) {
    return value as RuleNodeKind;
  }

  return "action";
}

function toRuleJsonValue(value: unknown): RuleJsonValue | undefined {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => toRuleJsonValue(item))
      .filter((item): item is RuleJsonValue => item !== undefined);
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, item]) => {
        const parsed = toRuleJsonValue(item);
        return parsed === undefined ? [] : [[key, parsed]];
      })
    );
  }

  return undefined;
}

export function getRuleNodeKindLabel(kind: RuleNodeKind) {
  return kindLabelMap[kind];
}

export function getRuleNodeStyle(kind: RuleNodeKind) {
  switch (kind) {
    case "start":
      return {
        background: "#d7ebff",
        border: "1px solid #9bc6f0",
        color: "#0f3c63"
      };
    case "condition":
      return {
        background: "#fff4d6",
        border: "1px solid #f3cf79",
        color: "#7a4a00"
      };
    case "branch":
      return {
        background: "#efe7ff",
        border: "1px solid #cbb6f6",
        color: "#50308a"
      };
    case "action":
      return {
        background: "#dcfce7",
        border: "1px solid #93d5aa",
        color: "#155d3b"
      };
    case "result":
      return {
        background: "#fee2e2",
        border: "1px solid #f3aaaa",
        color: "#8f2d2d"
      };
    case "compute":
      return {
        background: "#e2f2ff",
        border: "1px solid #9cc7e7",
        color: "#13466e"
      };
    default:
      return {
        background: "#f8fafc",
        border: "1px solid #d8e1ee",
        color: "#152233"
      };
  }
}

export function createRuleNode(
  kind: RuleNodeKind,
  label?: string,
  position?: { x: number; y: number },
  detail?: string
): RuleGraphNode {
  const suffix = Math.random().toString(36).slice(2, 8);

  return {
    id: `${kind}-${suffix}`,
    position: position ?? { x: 0, y: 0 },
    data: {
      kind,
      label: label ?? getRuleNodeKindLabel(kind),
      detail
    }
  };
}

export function createDefaultRuleGraph(scene = "订单创建后"): RuleGraph {
  const startNode = createRuleNode("start", "开始", { x: 32, y: 120 }, `场景：${scene}`);
  const conditionNode = createRuleNode(
    "condition",
    "风险判断",
    { x: 260, y: 120 },
    "示例：检查金额、地址、订单标签"
  );
  const actionNode = createRuleNode(
    "action",
    "执行动作",
    { x: 500, y: 56 },
    "示例：锁单、打标签、设置仓库"
  );
  const resultNode = createRuleNode(
    "result",
    "输出结果",
    { x: 500, y: 196 },
    "示例：自动通过、转人工、阻断"
  );

  return {
    nodes: [startNode, conditionNode, actionNode, resultNode],
    edges: [
      {
        id: `${startNode.id}-${conditionNode.id}`,
        source: startNode.id,
        target: conditionNode.id
      },
      {
        id: `${conditionNode.id}-${actionNode.id}`,
        source: conditionNode.id,
        target: actionNode.id,
        label: "命中"
      },
      {
        id: `${actionNode.id}-${resultNode.id}`,
        source: actionNode.id,
        target: resultNode.id
      }
    ]
  };
}

function normalizeNode(input: unknown, index: number): RuleGraphNode | null {
  if (typeof input === "string") {
    const inferredKind = index === 0 ? "start" : index === 1 ? "condition" : index === 2 ? "action" : "result";
    return createRuleNode(inferredKind, input, {
      x: 40 + index * 220,
      y: 120 + ((index % 2) === 0 ? 0 : 56)
    });
  }

  if (!isRecord(input)) {
    return null;
  }

  const id = typeof input.id === "string" ? input.id : `node-${index + 1}`;
  const positionRecord = isRecord(input.position) ? input.position : {};
  const dataRecord = isRecord(input.data) ? input.data : {};
  const kind = toRuleNodeKind(dataRecord.kind);

  return {
    id,
    position: {
      x: typeof positionRecord.x === "number" ? positionRecord.x : 40 + index * 220,
      y: typeof positionRecord.y === "number" ? positionRecord.y : 120
    },
    data: {
      kind,
      label:
        typeof dataRecord.label === "string"
          ? dataRecord.label
          : typeof input.label === "string"
            ? input.label
            : getRuleNodeKindLabel(kind),
      ...(typeof dataRecord.detail === "string" ? { detail: dataRecord.detail } : {}),
      ...(dataRecord.config !== undefined
        ? { config: toRuleJsonValue(dataRecord.config) }
        : {})
    }
  };
}

function normalizeEdge(input: unknown, index: number, fallbackNodes: RuleGraphNode[]): RuleGraphEdge | null {
  if (!isRecord(input)) {
    if (fallbackNodes[index] && fallbackNodes[index + 1]) {
      return {
        id: `edge-${index + 1}`,
        source: fallbackNodes[index].id,
        target: fallbackNodes[index + 1].id
      };
    }

    return null;
  }

  const source = typeof input.source === "string" ? input.source : "";
  const target = typeof input.target === "string" ? input.target : "";

  if (!source || !target) {
    return null;
  }

  return {
    id: typeof input.id === "string" ? input.id : `edge-${index + 1}`,
    source,
    target,
    ...(typeof input.label === "string" ? { label: input.label } : {})
  };
}

export function normalizeRuleGraph(value: unknown, scene?: string): RuleGraph {
  if (isRecord(value)) {
    const rawNodes = Array.isArray(value.nodes) ? value.nodes : [];
    const nodes = rawNodes
      .map((item, index) => normalizeNode(item, index))
      .filter((item): item is RuleGraphNode => item !== null);

    if (nodes.length > 0) {
      const rawEdges = Array.isArray(value.edges) ? value.edges : [];
      const edges =
        rawEdges.length > 0
          ? rawEdges
              .map((item, index) => normalizeEdge(item, index, nodes))
              .filter((item): item is RuleGraphEdge => item !== null)
          : nodes
              .slice(0, -1)
              .map((node, index) => ({
                id: `edge-auto-${index + 1}`,
                source: node.id,
                target: nodes[index + 1].id
              }));

      return {
        nodes,
        edges
      };
    }
  }

  return createDefaultRuleGraph(scene);
}

export function ruleGraphToText(graph: RuleGraph) {
  return JSON.stringify(graph, null, 2);
}

export function parseRuleGraphText(text: string, scene?: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    return {
      ok: false as const,
      message: "规则图不能为空。"
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const graph = normalizeRuleGraph(parsed, scene);

    if (graph.nodes.length === 0) {
      return {
        ok: false as const,
        message: "规则图至少需要一个节点。"
      };
    }

    return {
      ok: true as const,
      value: graph
    };
  } catch {
    return {
      ok: false as const,
      message: "规则图解析失败，请输入合法 JSON。"
    };
  }
}

export function summarizeRuleGraph(graph: RuleGraph) {
  return {
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    labels: graph.nodes.slice(0, 5).map((node) => node.data.label),
    pathPreview: buildRuleExecutionPath(graph).slice(0, 6).join(" -> ")
  };
}

export function buildRuleExecutionPath(graph: RuleGraph) {
  if (graph.nodes.length === 0) {
    return [];
  }

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const outgoing = graph.edges.reduce(
    (map, edge) => {
      const current = map.get(edge.source) ?? [];
      current.push(edge);
      map.set(edge.source, current);
      return map;
    },
    new Map<string, RuleGraphEdge[]>()
  );

  const startNode = graph.nodes.find((node) => node.data.kind === "start") ?? graph.nodes[0];
  const visited = new Set<string>();
  const labels: string[] = [];
  let currentNode: RuleGraphNode | undefined = startNode;

  while (currentNode && !visited.has(currentNode.id)) {
    visited.add(currentNode.id);
    labels.push(currentNode.data.label);
    const nextEdge: RuleGraphEdge | undefined = (outgoing.get(currentNode.id) ?? [])[0];
    currentNode = nextEdge ? nodesById.get(nextEdge.target) : undefined;
  }

  if (labels.length === 0) {
    return graph.nodes.map((node) => node.data.label);
  }

  return labels;
}
