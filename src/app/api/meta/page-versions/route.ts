import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { hasPermission } from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
import { performMetaPageVersionAction } from "@/server/services/meta-service";

type PageVersionAction = "publish" | "clone-version" | "rollback";

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
  const action = getSingleFormValue(formData, "action") as PageVersionAction;

  if (action !== "publish" && action !== "clone-version" && action !== "rollback") {
    const invalidUrl = new URL("/meta", request.url);
    invalidUrl.searchParams.set("error", "不支持的页面版本治理操作。");
    return NextResponse.redirect(invalidUrl, { status: 303 });
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

  const targetUrl = new URL("/meta", request.url);
  targetUrl.searchParams.set(result.ok ? "notice" : "error", result.message);

  return NextResponse.redirect(targetUrl, { status: 303 });
}
