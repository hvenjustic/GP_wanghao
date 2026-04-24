import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { hasPermission } from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
import { createRelativeRedirect, withQuery } from "@/lib/http/redirect";
import { performMetaPageVersionAction } from "@/server/services/meta-service";

type PageVersionAction = "publish" | "clone-version" | "rollback";

function getSingleFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
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
  const action = getSingleFormValue(formData, "action") as PageVersionAction;

  if (action !== "publish" && action !== "clone-version" && action !== "rollback") {
    return createRelativeRedirect(withQuery("/meta#page-version-governance", { error: "不支持的页面版本治理操作。" }), 303);
  }

  const targetVersionText = getSingleFormValue(formData, "targetVersion");
  const targetVersion = targetVersionText ? Number(targetVersionText) : undefined;
  const result = await performMetaPageVersionAction({
    action,
    session,
    payload: {
      pageId: getSingleFormValue(formData, "pageId"),
      note: getSingleFormValue(formData, "note"),
      reason: getSingleFormValue(formData, "reason"),
      targetVersion
    }
  });

  revalidatePath("/meta");

  return createRelativeRedirect(
    withQuery("/meta#page-version-governance", { [result.ok ? "notice" : "error"]: result.message }),
    303
  );
}
