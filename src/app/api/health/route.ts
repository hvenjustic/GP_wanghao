import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "gp-wanghao",
    time: new Date().toISOString()
  });
}
