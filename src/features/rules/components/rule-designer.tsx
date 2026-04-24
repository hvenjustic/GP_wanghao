"use client";

import { useEffect, useRef, useState } from "react";
import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node
} from "@xyflow/react";
import {
  ruleNodeConfigSemantics,
  ruleNodeConfigTemplates,
  ruleNodeTemplates
} from "@/features/rules/config/rule-scenes";
import {
  createDefaultRuleGraph,
  createRuleNode,
  getRuleNodeKindLabel,
  getRuleNodeStyle,
  normalizeRuleGraph,
  type RuleGraph,
  type RuleGraphNode,
  type RuleNodeKind
} from "@/features/rules/lib/rule-graph";

type CanvasNode = Node<RuleGraphNode["data"]>;
type CanvasEdge = Edge;

type RuleDesignerProps = {
  inputName: string;
  initialGraphText: string;
  scene: string;
  readOnly?: boolean;
};

function parseInitialGraph(text: string, scene: string) {
  try {
    return normalizeRuleGraph(JSON.parse(text) as unknown, scene);
  } catch {
    return createDefaultRuleGraph(scene);
  }
}

function toCanvasNode(node: RuleGraphNode): CanvasNode {
  const style = getRuleNodeStyle(node.data.kind);

  return {
    ...node,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    style: {
      ...style,
      borderRadius: 18,
      minWidth: 168,
      padding: 12,
      boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
      fontSize: 13,
      fontWeight: 600
    }
  };
}

function toStoredGraph(nodes: CanvasNode[], edges: CanvasEdge[]): RuleGraph {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      position: node.position,
      data: {
        kind: node.data.kind,
        label: node.data.label,
        ...(node.data.detail ? { detail: node.data.detail } : {}),
        ...(node.data.config !== undefined ? { config: node.data.config } : {})
      }
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...(edge.label ? { label: String(edge.label) } : {})
    }))
  };
}

function getTemplateConfig(kind: RuleNodeKind, scene: string): RuleGraphNode["data"]["config"] {
  const template = structuredClone(ruleNodeConfigTemplates[kind]) as Exclude<
    RuleGraphNode["data"]["config"],
    undefined
  >;

  if (kind === "start" && template && typeof template === "object" && !Array.isArray(template)) {
    return {
      ...template,
      scene
    };
  }

  return template;
}

export function RuleDesigner({
  inputName,
  initialGraphText,
  scene,
  readOnly = false
}: RuleDesignerProps) {
  const initialGraph = parseInitialGraph(initialGraphText, scene);
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialGraph.nodes.map((node) => toCanvasNode(node))
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialGraph.edges);
  const [selectedNodeId, setSelectedNodeId] = useState(initialGraph.nodes[0]?.id ?? "");
  const [configText, setConfigText] = useState("{}");
  const configDraftsRef = useRef<Record<string, string>>({});
  const [configError, setConfigError] = useState("");

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedTemplate = selectedNode
    ? getTemplateConfig(selectedNode.data.kind, scene)
    : null;
  const selectedSemantics = selectedNode
    ? ruleNodeConfigSemantics[selectedNode.data.kind]
    : [];
  const selectedOutgoingEdges = selectedNode
    ? edges.filter((edge) => edge.source === selectedNode.id)
    : [];
  const selectedBranchTargets = selectedOutgoingEdges.map((edge) => {
    const targetNode = nodes.find((node) => node.id === edge.target);
    return {
      edgeId: edge.id,
      targetId: edge.target,
      targetLabel: targetNode?.data.label ?? edge.target,
      edgeLabel: edge.label ? String(edge.label) : ""
    };
  });

  useEffect(() => {
    if (!selectedNode && nodes[0]) {
      setSelectedNodeId(nodes[0].id);
    }
  }, [nodes, selectedNode]);

  useEffect(() => {
    if (!selectedNode) {
      setConfigText("{}");
      setConfigError("");
      return;
    }

    setConfigText(
      configDraftsRef.current[selectedNode.id] ??
        JSON.stringify(selectedNode.data.config ?? {}, null, 2)
    );
    setConfigError("");
  }, [selectedNodeId, selectedNode]);

  function updateNodeConfig(
    nodeId: string,
    config: RuleGraphNode["data"]["config"] | undefined
  ) {
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                config
              }
            }
          : node
      )
    );
  }

  function handleAddNode(kind: RuleNodeKind) {
    if (readOnly) {
      return;
    }

    const nextNode = createRuleNode(
      kind,
      getRuleNodeKindLabel(kind),
      {
        x: 48 + (nodes.length % 3) * 220,
        y: 80 + Math.floor(nodes.length / 3) * 140
      },
      ruleNodeTemplates.find((template) => template.kind === kind)?.detail
    );

    const canvasNode = toCanvasNode(nextNode);
    setNodes((currentNodes) => [...currentNodes, canvasNode]);
    setSelectedNodeId(canvasNode.id);
  }

  function handleUpdateNode(field: "label" | "detail", value: string) {
    if (!selectedNode || readOnly) {
      return;
    }

    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === selectedNode.id
          ? {
              ...node,
              data: {
                ...node.data,
                [field]: value
              }
            }
          : node
      )
    );
  }

  function handleApplyConfig() {
    if (!selectedNode || readOnly) {
      return;
    }

    const trimmed = configText.trim();

    if (!trimmed) {
      updateNodeConfig(selectedNode.id, undefined);
      setConfigError("");
      return;
    }

    try {
      const parsed = JSON.parse(trimmed) as RuleGraphNode["data"]["config"];
      updateNodeConfig(selectedNode.id, parsed);
      setConfigError("");
    } catch {
      setConfigError("节点配置 JSON 解析失败，请输入合法对象。");
    }
  }

  function handleConfigTextChange(value: string) {
    setConfigText(value);

    if (!selectedNode || readOnly) {
      return;
    }

    configDraftsRef.current[selectedNode.id] = value;

    const trimmed = value.trim();
    if (!trimmed) {
      updateNodeConfig(selectedNode.id, undefined);
      setConfigError("");
      return;
    }

    try {
      const parsed = JSON.parse(trimmed) as RuleGraphNode["data"]["config"];
      updateNodeConfig(selectedNode.id, parsed);
      setConfigError("");
    } catch {
      // Keep the per-node draft while the user is still typing invalid JSON.
    }
  }

  function handleLoadTemplate() {
    if (!selectedNode || readOnly) {
      return;
    }

    const template = getTemplateConfig(selectedNode.data.kind, scene);
    const nextText = JSON.stringify(template ?? {}, null, 2);
    setConfigText(nextText);
    configDraftsRef.current[selectedNode.id] = nextText;
    updateNodeConfig(selectedNode.id, template);
    setConfigError("");
  }

  function handleDeleteNode() {
    if (!selectedNode || readOnly) {
      return;
    }

    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== selectedNode.id));
    setEdges((currentEdges) =>
      currentEdges.filter(
        (edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id
      )
    );
    setSelectedNodeId("");
  }

  function handleConnect(connection: Connection) {
    if (readOnly || !connection.source || !connection.target) {
      return;
    }

    setEdges((currentEdges) =>
      addEdge(
        {
          ...connection,
          id: `edge-${Date.now()}-${currentEdges.length + 1}`
        },
        currentEdges
      )
    );
  }

  const serializedGraph = JSON.stringify(toStoredGraph(nodes, edges), null, 2);

  return (
    <div className="designer-shell">
      <input type="hidden" name={inputName} value={serializedGraph} readOnly />

      <div className="designer-toolbar">
        {ruleNodeTemplates.map((template) => (
          <button
            key={template.kind}
            type="button"
            className="button-secondary"
            onClick={() => handleAddNode(template.kind)}
            disabled={readOnly}
          >
            新增{template.label}
          </button>
        ))}
      </div>

      <div className="designer-layout">
        <div className="designer-stage">
          <ReactFlow
            fitView
            nodes={nodes}
            edges={edges}
            onNodesChange={readOnly ? undefined : onNodesChange}
            onEdgesChange={readOnly ? undefined : onEdgesChange}
            onConnect={handleConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            elementsSelectable
          >
            <MiniMap zoomable pannable />
            <Controls />
            <Background gap={20} size={1} />
          </ReactFlow>
        </div>

        <aside className="designer-panel">
          <div className="table-cell-stack">
            <strong>节点编辑器</strong>
            <span className="muted">
              当前图包含 {nodes.length} 个节点，{edges.length} 条连线。
            </span>
          </div>

          {selectedNode ? (
            <>
              <label className="form-field">
                <span className="field-label">节点名称</span>
                <input
                  className="text-input"
                  value={selectedNode.data.label}
                  onChange={(event) => handleUpdateNode("label", event.target.value)}
                  readOnly={readOnly}
                />
              </label>

              <label className="form-field">
                <span className="field-label">节点类型</span>
                <input
                  className="text-input"
                  value={getRuleNodeKindLabel(selectedNode.data.kind)}
                  readOnly
                />
              </label>

              <label className="form-field">
                <span className="field-label">节点 ID</span>
                <input className="text-input" value={selectedNode.id} readOnly />
              </label>

              <label className="form-field">
                <span className="field-label">节点说明</span>
                <textarea
                  className="textarea-input textarea-input-compact"
                  value={selectedNode.data.detail ?? ""}
                  onChange={(event) => handleUpdateNode("detail", event.target.value)}
                  readOnly={readOnly}
                />
              </label>

              <label className="form-field">
                <span className="field-label">节点配置 JSON</span>
                <textarea
                  className="textarea-input"
                  value={configText}
                  onChange={(event) => handleConfigTextChange(event.target.value)}
                  readOnly={readOnly}
                />
              </label>

              <div className="table-cell-stack">
                <strong>节点配置语义</strong>
                {selectedSemantics.map((item) => (
                  <span key={`${selectedNode.id}-${item}`} className="muted">
                    {item}
                  </span>
                ))}
              </div>

              {selectedTemplate ? (
                <div className="table-cell-stack">
                  <strong>推荐配置模板</strong>
                  <pre className="code-block">
                    {JSON.stringify(selectedTemplate, null, 2)}
                  </pre>
                </div>
              ) : null}

              {selectedNode.data.kind === "branch" ? (
                <div className="table-cell-stack">
                  <strong>当前分支可选目标</strong>
                  {selectedBranchTargets.length > 0 ? (
                    selectedBranchTargets.map((item) => (
                      <span key={item.edgeId} className="muted">
                        {item.targetLabel} · `{item.targetId}`
                        {item.edgeLabel ? ` · 连线标签：${item.edgeLabel}` : ""}
                      </span>
                    ))
                  ) : (
                    <span className="muted">
                      当前分支节点还没有下游连线。请先在画布中把分支节点连接到目标节点，再填写
                      `branches[].target` 或 `defaultTarget`。
                    </span>
                  )}
                </div>
              ) : null}

              {configError ? <div className="alert-banner alert-banner-error">{configError}</div> : null}

              <div className="action-stack">
                {!readOnly ? (
                  <>
                    <button type="button" className="button-secondary" onClick={handleLoadTemplate}>
                      载入配置模板
                    </button>
                    <button type="button" className="button-primary" onClick={handleApplyConfig}>
                      应用节点配置
                    </button>
                    <button type="button" className="button-danger" onClick={handleDeleteNode}>
                      删除当前节点
                    </button>
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <strong>当前没有选中的节点。</strong>
              <span className="muted">点击画布中的节点后，可在这里编辑名称、说明和配置。</span>
            </div>
          )}

          <div className="table-cell-stack">
            <strong>设计提示</strong>
            <span className="muted">已发布版本保存时会自动另存为新草稿，避免直接覆盖线上版本。</span>
            <span className="muted">连线通过拖拽节点两侧锚点完成；删除节点会自动清理关联连线。</span>
            <span className="muted">分支节点的 `target` 必须填写当前节点已连接下游节点的 ID。</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
