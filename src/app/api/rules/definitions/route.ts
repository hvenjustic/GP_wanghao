import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { hasPermission } from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
import { createRelativeRedirect, withQuery } from "@/lib/http/redirect";
import { performRuleDefinitionAction } from "@/server/services/rule-service";

type RuleDefinitionAction = "create" | "update" | "delete" | "enable" | "disable";

function getSingleFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function POST(request: NextRequest) {
  const session = await getAuthSession();

  if (!session) {
    return createRelativeRedirect(withQuery("/login", { redirect: "/rules" }), 303);
  }

  if (!hasPermission(session, "rules:manage")) {
    return createRelativeRedirect(withQuery("/forbidden", { required: "rules:manage" }), 303);
  }

  const formData = await request.formData();
  const action = getSingleFormValue(formData, "action") as RuleDefinitionAction;

  if (!["create", "update", "delete", "enable", "disable"].includes(action)) {
    return createRelativeRedirect(withQuery("/rules", { error: "不支持的规则定义操作。" }), 303);
  }

  const result = await performRuleDefinitionAction({
    action,
    session,
    payload: {
      id: getSingleFormValue(formData, "id"),
      ruleCode: getSingleFormValue(formData, "ruleCode"),
      name: getSingleFormValue(formData, "name"),
      type: getSingleFormValue(formData, "type"),
      scene: getSingleFormValue(formData, "scene"),
      reason: getSingleFormValue(formData, "reason")
    }
  });

  revalidatePath("/rules");

  return createRelativeRedirect(
    withQuery("/rules", {
      ruleId: result.ruleId,
      versionId: result.versionId,
      [result.ok ? "notice" : "error"]: result.message
    }),
    303
  );
}
