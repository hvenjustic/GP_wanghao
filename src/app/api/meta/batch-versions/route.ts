import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { hasPermission } from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
import {
  performMetaBatchVersionAction,
  type MetaBatchVersionAction
} from "@/server/services/meta-service";
import { saveMetaBatchFeedback } from "@/server/services/meta-batch-feedback-store";

const metaBatchVersionActions: MetaBatchVersionAction[] = ["publish", "rollback"];

function getSingleFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getSafeRedirectTarget(value: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/meta";
  }

  return value;
}

export async function POST(request: NextRequest) {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.redirect(new URL("/login?redirect=/meta", request.url), {
      status: 303
    });
  }

  if (!hasPermission(session, "meta:manage")) {
    return NextResponse.redirect(new URL("/forbidden?required=meta:manage", request.url), {
      status: 303
    });
  }

  const formData = await request.formData();
  const action = getSingleFormValue(formData, "action") as MetaBatchVersionAction;
  const redirectTo = getSafeRedirectTarget(getSingleFormValue(formData, "redirectTo"));
  const targetRefs = formData
    .getAll("targetRefs")
    .filter((item): item is string => typeof item === "string");

  if (!metaBatchVersionActions.includes(action)) {
    const invalidUrl = new URL(redirectTo, request.url);
    invalidUrl.searchParams.set("error", "不支持的低代码批量治理操作。");
    return NextResponse.redirect(invalidUrl, { status: 303 });
  }

  const result = await performMetaBatchVersionAction({
    action,
    session,
    payload: {
      targetRefs,
      note: getSingleFormValue(formData, "note"),
      reason: getSingleFormValue(formData, "reason")
    }
  });

  revalidatePath("/meta");

  const targetUrl = new URL(redirectTo, request.url);
  targetUrl.searchParams.set(result.ok ? "notice" : "error", result.message);

  if (result.items.length > 0) {
    const batchFeedbackId = saveMetaBatchFeedback({
      action,
      summary: result.summary,
      items: result.items
    });
    targetUrl.searchParams.set("batchFeedbackId", batchFeedbackId);
  }

  return NextResponse.redirect(targetUrl, { status: 303 });
}
