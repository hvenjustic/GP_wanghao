import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { hasPermission } from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
import { performRuleDefinitionAction } from "@/server/services/rule-service";

type RuleDefinitionAction = "create" | "update" | "delete" | "enable" | "disable";

function getSingleFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function POST(request: NextRequest) {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.redirect(new URL("/login?redirect=/rules", request.url), {
      status: 303
    });
  }

  if (!hasPermission(session, "rules:manage")) {
    return NextResponse.redirect(new URL("/forbidden?required=rules:manage", request.url), {
      status: 303
    });
  }

  const formData = await request.formData();
  const action = getSingleFormValue(formData, "action") as RuleDefinitionAction;

  if (!["create", "update", "delete", "enable", "disable"].includes(action)) {
    const invalidUrl = new URL("/rules", request.url);
    invalidUrl.searchParams.set("error", "不支持的规则定义操作。");
    return NextResponse.redirect(invalidUrl, { status: 303 });
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

  const targetUrl = new URL("/rules", request.url);

  if (result.ruleId) {
    targetUrl.searchParams.set("ruleId", result.ruleId);
  }

  if (result.versionId) {
    targetUrl.searchParams.set("versionId", result.versionId);
  }

  targetUrl.searchParams.set(result.ok ? "notice" : "error", result.message);

  return NextResponse.redirect(targetUrl, { status: 303 });
}
