import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { hasPermission } from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
import { performRuleTestRunAction } from "@/server/services/rule-service";

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
  const result = await performRuleTestRunAction({
    session,
    payload: {
      versionId: getSingleFormValue(formData, "versionId"),
      orderId: getSingleFormValue(formData, "orderId"),
      sampleInputText: getSingleFormValue(formData, "sampleInputText")
    }
  });

  revalidatePath("/rules");
  revalidatePath("/rule-logs");

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
