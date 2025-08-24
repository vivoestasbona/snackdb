// app/api/images/snack/route.js
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"; // (이전 단계에서 만든 서버용 클라이언트)

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path") || "";
    if (!path || path.includes("..")) {
      return NextResponse.json({ ok:false, error:"INVALID_PATH" }, { status:400 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .storage
      .from("snack-images")
      .createSignedUrl(path, 60 * 5); // 5분 유효

    if (error || !data?.signedUrl) {
      return NextResponse.json({ ok:false, error:error?.message || "SIGN_FAILED" }, { status:400 });
    }

    // 서명 URL로 리다이렉트 (브라우저는 실제 파일을 바로 요청)
    return NextResponse.redirect(data.signedUrl, 302);
  } catch (e) {
    return NextResponse.json({ ok:false, error:e.message || "SERVER_ERROR" }, { status:500 });
  }
}
