import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { hasPermission } from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
import { createRelativeRedirect, withQuery } from "@/lib/http/redirect";
import { performRuleTestRunAction } from "@/server/services/rule-service";

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

  return createRelativeRedirect(
    withQuery("/rules", {
      ruleId: result.ruleId,
      versionId: result.versionId,
      [result.ok ? "notice" : "error"]: result.message
    }),
    303
  );
}
