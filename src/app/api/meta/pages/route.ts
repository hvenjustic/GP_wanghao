import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { hasPermission } from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
import { createRelativeRedirect, withQuery } from "@/lib/http/redirect";
import { performMetaPageAction } from "@/server/services/meta-service";

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
  const action = getSingleFormValue(formData, "action");
  const versionText = getSingleFormValue(formData, "version");
  const version = versionText ? Number(versionText) : undefined;

  if (action !== "create" && action !== "update" && action !== "delete") {
    return createRelativeRedirect(withQuery("/meta#page-crud", { error: "不支持的页面配置操作。" }), 303);
  }

  const result = await performMetaPageAction({
    action,
    session,
    payload: {
      id: getSingleFormValue(formData, "id"),
      entityId: getSingleFormValue(formData, "entityId"),
      pageCode: getSingleFormValue(formData, "pageCode"),
      pageType: getSingleFormValue(formData, "pageType"),
      version,
      status: getSingleFormValue(formData, "status") as
        | "DRAFT"
        | "PUBLISHED"
        | "DISABLED"
        | undefined,
      schemaText: getSingleFormValue(formData, "schemaText")
    }
  });

  revalidatePath("/meta");

  return createRelativeRedirect(
    withQuery("/meta#page-crud", { [result.ok ? "notice" : "error"]: result.message }),
    303
  );
}
