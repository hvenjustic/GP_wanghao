import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { hasPermission } from "@/lib/auth/types";
import { getAuthSession } from "@/lib/auth/session";
import { performMetaEntityAction } from "@/server/services/meta-service";

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
  const action = getSingleFormValue(formData, "action");

  if (action !== "create" && action !== "update" && action !== "delete") {
    const invalidUrl = new URL("/meta", request.url);
    invalidUrl.searchParams.set("error", "不支持的实体配置操作。");
    return NextResponse.redirect(invalidUrl, { status: 303 });
  }

  const result = await performMetaEntityAction({
    action,
    session,
    payload: {
      id: getSingleFormValue(formData, "id"),
      entityCode: getSingleFormValue(formData, "entityCode"),
      name: getSingleFormValue(formData, "name"),
      type: getSingleFormValue(formData, "type"),
      status: getSingleFormValue(formData, "status") as
        | "DRAFT"
        | "PUBLISHED"
        | "DISABLED"
        | undefined,
      schemaText: getSingleFormValue(formData, "schemaText")
    }
  });

  revalidatePath("/meta");

  const targetUrl = new URL("/meta", request.url);
  targetUrl.searchParams.set(result.ok ? "notice" : "error", result.message);

  return NextResponse.redirect(targetUrl, { status: 303 });
}
