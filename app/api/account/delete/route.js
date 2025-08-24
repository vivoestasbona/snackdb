// app/api/account/delete/route.js
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  try {
    const admin = getSupabaseAdmin();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ ok: false, error: "토큰 누락" }, { status: 401 });
    }

    // 전달된 access_token으로 현재 사용자 식별
    const tmp = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false }});
    const { data: userData, error: userErr } = await tmp.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ ok: false, error: "유효하지 않은 토큰" }, { status: 401 });
    }

    // 실제 삭제
    const userId = userData.user.id;
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || "서버 오류" }, { status: 500 });
  }
}
