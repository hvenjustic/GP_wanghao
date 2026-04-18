export const ruleComparisonOperatorValues = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "includes",
  "notIncludes",
  "startsWith",
  "endsWith",
  "oneOf",
  "exists"
] as const;

export type RuleComparisonOperator = (typeof ruleComparisonOperatorValues)[number];

export const ruleExpressionKinds = ["comparison", "group", "not"] as const;
export type RuleExpressionKind = (typeof ruleExpressionKinds)[number];

export const ruleExpressionGroupCombinators = ["and", "or"] as const;
export type RuleExpressionGroupCombinator = (typeof ruleExpressionGroupCombinators)[number];

export type RuleComparisonExpression = {
  type: "comparison";
  field: string;
  operator: RuleComparisonOperator;
  value?: unknown;
};

export type RuleGroupExpression = {
  type: "group";
  combinator: RuleExpressionGroupCombinator;
  expressions: RuleConditionExpression[];
};

export type RuleNotExpression = {
  type: "not";
  expression: RuleConditionExpression;
};

export type RuleConditionExpression =
  | RuleComparisonExpression
  | RuleGroupExpression
  | RuleNotExpression;

export type RuleConditionEvaluation = {
  type: RuleExpressionKind;
  matched: boolean;
  summary: string;
  field?: string;
  operator?: RuleComparisonOperator;
  actualText?: string;
  expectedText?: string;
  combinator?: RuleExpressionGroupCombinator;
  children?: RuleConditionEvaluation[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isEmptyRecord(value: Record<string, unknown>) {
  return Object.keys(value).length === 0;
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => formatValue(item)).join(", ")}]`;
  }

  if (isRecord(value)) {
    const entries = Object.entries(value).slice(0, 4);
    return `{${entries.map(([key, item]) => `${key}: ${formatValue(item)}`).join(", ")}}`;
  }

  if (value === undefined) {
    return "未定义";
  }

  if (value === null) {
    return "空";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
}

function normalizeExpressionValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeExpressionValue(item));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeExpressionValue(item)])
    );
  }

  return String(value);
}

function normalizeComparisonExpression(
  value: Record<string, unknown>
): RuleComparisonExpression | null {
  const field = typeof value.field === "string" ? value.field.trim() : "";
  const operator =
    typeof value.operator === "string" &&
    ruleComparisonOperatorValues.includes(value.operator as RuleComparisonOperator)
      ? (value.operator as RuleComparisonOperator)
      : "eq";

  if (!field) {
    return null;
  }

  return {
    type: "comparison",
    field,
    operator,
    ...(value.value !== undefined ? { value: normalizeExpressionValue(value.value) } : {})
  };
}

export function normalizeRuleConditionExpression(value: unknown): RuleConditionExpression | null {
  if (!isRecord(value)) {
    return null;
  }

  const type =
    typeof value.type === "string"
      ? value.type
      : "field" in value || "operator" in value || "value" in value
        ? "comparison"
        : "";

  if (type === "comparison") {
    return normalizeComparisonExpression(value);
  }

  if (type === "group") {
    const combinator =
      typeof value.combinator === "string" &&
      ruleExpressionGroupCombinators.includes(value.combinator as RuleExpressionGroupCombinator)
        ? (value.combinator as RuleExpressionGroupCombinator)
        : "and";
    const expressions = Array.isArray(value.expressions)
      ? value.expressions
          .map((item) => normalizeRuleConditionExpression(item))
          .filter((item): item is RuleConditionExpression => item !== null)
      : [];

    if (expressions.length === 0) {
      return null;
    }

    return {
      type: "group",
      combinator,
      expressions
    };
  }

  if (type === "not") {
    const expression = normalizeRuleConditionExpression(value.expression);

    if (!expression) {
      return null;
    }

    return {
      type: "not",
      expression
    };
  }

  return null;
}

export function parseRuleConditionExpressionConfig(config: unknown) {
  if (!isRecord(config) || isEmptyRecord(config)) {
    return null;
  }

  if ("expression" in config) {
    return normalizeRuleConditionExpression(config.expression);
  }

  return normalizeRuleConditionExpression(config);
}

export function validateRuleConditionExpressionConfig(config: unknown) {
  if (!isRecord(config) || isEmptyRecord(config)) {
    return [] as string[];
  }

  if ("expression" in config) {
    return validateRuleConditionExpression(config.expression, "expression");
  }

  if ("field" in config || "operator" in config || "value" in config) {
    return validateRuleConditionExpression(config, "expression");
  }

  return [] as string[];
}

export function validateRuleConditionExpression(
  value: unknown,
  path = "expression"
): string[] {
  if (!isRecord(value)) {
    return [`${path} 必须是对象。`];
  }

  const inferredType =
    typeof value.type === "string"
      ? value.type
      : "field" in value || "operator" in value || "value" in value
        ? "comparison"
        : "";

  if (inferredType === "comparison") {
    const field = typeof value.field === "string" ? value.field.trim() : "";
    const operator = typeof value.operator === "string" ? value.operator : "";
    const messages: string[] = [];

    if (!field) {
      messages.push(`${path}.field 不能为空。`);
    }

    if (!ruleComparisonOperatorValues.includes(operator as RuleComparisonOperator)) {
      messages.push(
        `${path}.operator 仅支持 ${ruleComparisonOperatorValues.join(" / ")}。`
      );
    }

    if (operator === "oneOf" && !Array.isArray(value.value)) {
      messages.push(`${path}.value 在 oneOf 场景下必须是数组。`);
    }

    if (operator !== "exists" && value.value === undefined) {
      messages.push(`${path}.value 不能为空。`);
    }

    return messages;
  }

  if (inferredType === "group") {
    const combinator = typeof value.combinator === "string" ? value.combinator : "";
    const expressions = Array.isArray(value.expressions) ? value.expressions : null;
    const messages: string[] = [];

    if (
      !ruleExpressionGroupCombinators.includes(
        combinator as RuleExpressionGroupCombinator
      )
    ) {
      messages.push(`${path}.combinator 仅支持 and / or。`);
    }

    if (!expressions || expressions.length === 0) {
      messages.push(`${path}.expressions 至少需要一个子表达式。`);
      return messages;
    }

    expressions.forEach((expression, index) => {
      messages.push(
        ...validateRuleConditionExpression(expression, `${path}.expressions[${index}]`)
      );
    });

    return messages;
  }

  if (inferredType === "not") {
    if (!("expression" in value)) {
      return [`${path}.expression 不能为空。`];
    }

    return validateRuleConditionExpression(value.expression, `${path}.expression`);
  }

  return [`${path}.type 仅支持 comparison / group / not。`];
}

export function describeRuleConditionExpression(expression: RuleConditionExpression): string {
  switch (expression.type) {
    case "comparison":
      return expression.operator === "exists"
        ? `${expression.field} exists`
        : `${expression.field} ${expression.operator} ${formatValue(expression.value)}`;
    case "group":
      return `${expression.combinator.toUpperCase()}(${expression.expressions
        .map((item) => describeRuleConditionExpression(item))
        .join("; ")})`;
    case "not":
      return `NOT(${describeRuleConditionExpression(expression.expression)})`;
  }
}

function resolvePathValue(context: unknown, path: string): unknown {
  const segments = path.split(".");
  let current = context;

  for (const segment of segments) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function evaluateComparisonOperator(
  actual: unknown,
  operator: RuleComparisonOperator,
  expected: unknown
) {
  switch (operator) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "gt":
      return Number(actual) > Number(expected);
    case "gte":
      return Number(actual) >= Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
    case "includes":
      if (Array.isArray(actual)) {
        return actual.includes(expected as never);
      }
      return String(actual ?? "").includes(String(expected ?? ""));
    case "notIncludes":
      if (Array.isArray(actual)) {
        return !actual.includes(expected as never);
      }
      return !String(actual ?? "").includes(String(expected ?? ""));
    case "startsWith":
      return String(actual ?? "").startsWith(String(expected ?? ""));
    case "endsWith":
      return String(actual ?? "").endsWith(String(expected ?? ""));
    case "oneOf":
      if (Array.isArray(expected)) {
        if (Array.isArray(actual)) {
          return actual.some((item) => expected.includes(item as never));
        }
        return expected.includes(actual as never);
      }
      return false;
    case "exists":
      return actual !== undefined && actual !== null && String(actual).trim() !== "";
  }
}

export function evaluateRuleConditionExpression(
  expression: RuleConditionExpression,
  context: unknown
): RuleConditionEvaluation {
  if (expression.type === "comparison") {
    const actual = resolvePathValue(context, expression.field);
    const matched = evaluateComparisonOperator(actual, expression.operator, expression.value);
    const expectedText =
      expression.operator === "exists" ? "非空" : formatValue(expression.value);
    const actualText = formatValue(actual);

    return {
      type: "comparison",
      matched,
      field: expression.field,
      operator: expression.operator,
      actualText,
      expectedText,
      summary: `${expression.field} ${expression.operator} ${expectedText}，实际值 ${actualText}，结果 ${matched ? "命中" : "未命中"}`
    };
  }

  if (expression.type === "group") {
    const children = expression.expressions.map((item) =>
      evaluateRuleConditionExpression(item, context)
    );
    const matched =
      expression.combinator === "and"
        ? children.every((item) => item.matched)
        : children.some((item) => item.matched);

    return {
      type: "group",
      matched,
      combinator: expression.combinator,
      children,
      summary: `${expression.combinator.toUpperCase()} 组合表达式${matched ? "命中" : "未命中"}，子表达式 ${children.filter((item) => item.matched).length}/${children.length} 命中`
    };
  }

  const child = evaluateRuleConditionExpression(expression.expression, context);
  return {
    type: "not",
    matched: !child.matched,
    children: [child],
    summary: `NOT 取反表达式${!child.matched ? "命中" : "未命中"}，原表达式结果为${child.matched ? "命中" : "未命中"}`
  };
}
