import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { hasPermission } from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
import { createRelativeRedirect, withQuery } from "@/lib/http/redirect";
import { performMetaEntityVersionAction } from "@/server/services/meta-service";

type EntityVersionAction = "publish" | "rollback";

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
  const action = getSingleFormValue(formData, "action") as EntityVersionAction;

  if (action !== "publish" && action !== "rollback") {
    return createRelativeRedirect(withQuery("/meta#meta-object-governance", { error: "不支持的实体版本治理操作。" }), 303);
  }

  const result = await performMetaEntityVersionAction({
    action,
    session,
    payload: {
      entityId: getSingleFormValue(formData, "entityId"),
      snapshotId: getSingleFormValue(formData, "snapshotId"),
      reason: getSingleFormValue(formData, "reason"),
      note: getSingleFormValue(formData, "note")
    }
  });

  revalidatePath("/meta");

  return createRelativeRedirect(
    withQuery("/meta#meta-object-governance", { [result.ok ? "notice" : "error"]: result.message }),
    303
  );
}
