import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@shared/api/supabaseAdmin";

export async function DELETE(req, { params }) {
  const { id } = params || {};
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  // ✅ 1) 헤더에서 토큰 추출
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // ✅ 2) 토큰으로 사용자 확인
  const admin = getSupabaseAdmin();
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ✅ 3) 관리자 권한 확인 (profiles.role === 'admin')
  const uid = userRes.user.id;
  const { data: prof, error: profErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", uid)
    .single();
  if (profErr || prof?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 4) 자식 레코드 정리(스키마에 맞게 조정)
  const dels = await Promise.all([
    admin.from("snack_flavors_map").delete().eq("snack_id", id),
    admin.from("snack_keywords_map").delete().eq("snack_id", id),
    admin.from("snack_scores").delete().eq("snack_id", id),
    // admin.from("snack_likes").delete().eq("snack_id", id),  // 있으면 해제
    // admin.from("reviews").delete().eq("snack_id", id),       // 있으면 해제
  ]);
  const mapErr = dels.find((r) => r?.error)?.error;
  if (mapErr) return NextResponse.json({ error: mapErr.message }, { status: 500 });

  // 5) 이미지 경로 조회 (있으면 스토리지 삭제)
  const { data: snack, error: readErr } = await admin
    .from("snacks")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

  // 6) 본체 삭제
  const { error: delErr } = await admin.from("snacks").delete().eq("id", id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  // 7) 스토리지 삭제 (버킷 이름 맞추기)
  if (snack?.image_path) {
    await admin.storage.from("snack-images").remove([snack.image_path]);
  }

  return NextResponse.json({ ok: true });
}
