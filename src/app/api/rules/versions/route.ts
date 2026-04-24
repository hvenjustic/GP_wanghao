import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { hasPermission } from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
import { createRelativeRedirect, withQuery } from "@/lib/http/redirect";
import { performRuleVersionAction } from "@/server/services/rule-service";

type RuleVersionAction = "save-draft" | "clone-version" | "publish" | "rollback";

function getSingleFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getOptionalNumber(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
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
  const action = getSingleFormValue(formData, "action") as RuleVersionAction;

  if (!["save-draft", "clone-version", "publish", "rollback"].includes(action)) {
    return createRelativeRedirect(withQuery("/rules#designer", { error: "不支持的规则版本操作。" }), 303);
  }

  const result = await performRuleVersionAction({
    action,
    session,
    payload: {
      versionId: getSingleFormValue(formData, "versionId"),
      targetVersion: getOptionalNumber(getSingleFormValue(formData, "targetVersion")),
      note: getSingleFormValue(formData, "note"),
      reason: getSingleFormValue(formData, "reason"),
      graphText: getSingleFormValue(formData, "graphText")
    }
  });

  revalidatePath("/rules");

  return createRelativeRedirect(
    withQuery("/rules#designer", {
      ruleId: result.ruleId,
      versionId: result.versionId,
      [result.ok ? "notice" : "error"]: result.message
    }),
    303
  );
}
