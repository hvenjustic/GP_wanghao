import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { hasPermission } from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
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
  const action = getSingleFormValue(formData, "action") as RuleVersionAction;

  if (!["save-draft", "clone-version", "publish", "rollback"].includes(action)) {
    const invalidUrl = new URL("/rules", request.url);
    invalidUrl.searchParams.set("error", "不支持的规则版本操作。");
    return NextResponse.redirect(invalidUrl, { status: 303 });
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
