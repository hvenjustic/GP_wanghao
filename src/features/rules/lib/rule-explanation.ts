export type RuleNodeExplanation = {
  nodeId?: string;
  nodeLabel: string;
  nodeKind?: string;
  outcome: string;
  summary: string;
  detail?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function deriveRuleNodeExplanationsFromPath(path: string) {
  const labels = path
    .split("->")
    .map((item) => item.trim())
    .filter(Boolean);

  return labels.map<RuleNodeExplanation>((label, index) => ({
    nodeLabel: label,
    outcome:
      index === 0 ? "ENTERED" : index === labels.length - 1 ? "RESULT" : "PATH",
    summary:
      index === 0
        ? `进入规则起点「${label}」。`
        : index === labels.length - 1
          ? `最终到达结果节点「${label}」。`
          : `沿执行路径进入节点「${label}」。`
  }));
}

export function normalizeRuleNodeExplanations(value: unknown, fallbackPath = "") {
  if (!Array.isArray(value)) {
    return fallbackPath ? deriveRuleNodeExplanationsFromPath(fallbackPath) : [];
  }

  const explanations = value.reduce<RuleNodeExplanation[]>((accumulator, item) => {
    if (!isRecord(item)) {
      return accumulator;
    }

    const nodeLabel = typeof item.nodeLabel === "string" ? item.nodeLabel.trim() : "";
    const summary = typeof item.summary === "string" ? item.summary.trim() : "";

    if (!nodeLabel || !summary) {
      return accumulator;
    }

    accumulator.push({
      ...(typeof item.nodeId === "string" ? { nodeId: item.nodeId } : {}),
      nodeLabel,
      ...(typeof item.nodeKind === "string" ? { nodeKind: item.nodeKind } : {}),
      outcome: typeof item.outcome === "string" ? item.outcome : "PATH",
      summary,
      ...(typeof item.detail === "string" && item.detail.trim()
        ? { detail: item.detail.trim() }
        : {})
    });

    return accumulator;
  }, []);

  if (explanations.length > 0) {
    return explanations;
  }

  return fallbackPath ? deriveRuleNodeExplanationsFromPath(fallbackPath) : [];
}

export function buildRuleReasonSummary(
  explanations: RuleNodeExplanation[],
  fallbackResult = "",
  fallbackPath = ""
) {
  const keyItems = explanations.filter((item) =>
    ["MATCHED", "ROUTED", "EXECUTED", "NOT_MATCHED"].includes(item.outcome)
  );

  if (keyItems.length > 0) {
    return keyItems
      .slice(0, 3)
      .map((item) => item.summary)
      .join("；");
  }

  if (fallbackResult) {
    return fallbackResult;
  }

  if (fallbackPath) {
    return `执行路径：${fallbackPath}`;
  }

  return "当前规则已执行，但尚未生成解释摘要。";
}

export function buildRuleExplanationSummary(
  explanations: RuleNodeExplanation[],
  resultText: string,
  decision?: string
) {
  const keyNodeCount = explanations.filter((item) =>
    ["MATCHED", "ROUTED", "EXECUTED", "RESULT"].includes(item.outcome)
  ).length;
  const decisionText = decision ? ` 决策：${decision}。` : "";

  if (keyNodeCount > 0) {
    return `本次规则共经过 ${explanations.length} 个节点，其中 ${keyNodeCount} 个关键节点影响最终结果。最终结果：${resultText}。${decisionText}`.trim();
  }

  return `本次规则已执行。最终结果：${resultText}。${decisionText}`.trim();
}
