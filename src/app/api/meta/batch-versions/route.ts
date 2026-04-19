import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { hasPermission } from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
import { createRelativeRedirect, withQuery } from "@/lib/http/redirect";
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
    return createRelativeRedirect(withQuery("/login", { redirect: "/meta" }), 303);
  }

  if (!hasPermission(session, "meta:manage")) {
    return createRelativeRedirect(withQuery("/forbidden", { required: "meta:manage" }), 303);
  }

  const formData = await request.formData();
  const action = getSingleFormValue(formData, "action") as MetaBatchVersionAction;
  const redirectTo = getSafeRedirectTarget(getSingleFormValue(formData, "redirectTo"));
  const targetRefs = formData
    .getAll("targetRefs")
    .filter((item): item is string => typeof item === "string");

  if (!metaBatchVersionActions.includes(action)) {
    return createRelativeRedirect(withQuery(redirectTo, { error: "不支持的低代码批量治理操作。" }), 303);
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

  const params: Record<string, string | undefined> = {
    [result.ok ? "notice" : "error"]: result.message
  };

  if (result.items.length > 0) {
    const batchFeedbackId = saveMetaBatchFeedback({
      action,
      summary: result.summary,
      items: result.items
    });
    params.batchFeedbackId = batchFeedbackId;
  }

  return createRelativeRedirect(withQuery(redirectTo, params), 303);
}
