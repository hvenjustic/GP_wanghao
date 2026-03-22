import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { hasPermission } from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
import { performMetaFieldVersionAction } from "@/server/services/meta-service";

type FieldVersionAction = "publish" | "rollback";

function getSingleFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
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
  const action = getSingleFormValue(formData, "action") as FieldVersionAction;

  if (action !== "publish" && action !== "rollback") {
    const invalidUrl = new URL("/meta", request.url);
    invalidUrl.searchParams.set("error", "不支持的字段版本治理操作。");
    return NextResponse.redirect(invalidUrl, { status: 303 });
  }

  const result = await performMetaFieldVersionAction({
    action,
    session,
    payload: {
      fieldId: getSingleFormValue(formData, "fieldId"),
      snapshotId: getSingleFormValue(formData, "snapshotId"),
      reason: getSingleFormValue(formData, "reason"),
      note: getSingleFormValue(formData, "note")
    }
  });

  revalidatePath("/meta");

  const targetUrl = new URL("/meta", request.url);
  targetUrl.searchParams.set(result.ok ? "notice" : "error", result.message);

  return NextResponse.redirect(targetUrl, { status: 303 });
}
