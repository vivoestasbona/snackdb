import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@shared/api/supabaseAdmin";

/** 관리자 토큰 → 관리자 검증 공통 유틸 */
async function assertAdmin(req, admin) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return [null, NextResponse.json({ error: "unauthorized" }, { status: 401 })];
  const { data: u, error: ue } = await admin.auth.getUser(token);
  if (ue || !u?.user?.id) return [null, NextResponse.json({ error: "unauthorized" }, { status: 401 })];
  const uid = u.user.id;
  const { data: prof, error: pe } = await admin.from("profiles").select("role").eq("id", uid).single();
  if (pe || prof?.role !== "admin") return [null, NextResponse.json({ error: "forbidden" }, { status: 403 })];
  return [uid, null];
}

export async function POST(req) {
  const admin = getSupabaseAdmin();

  // 1) 관리자 검증
  const [, deny] = await assertAdmin(req, admin);
  if (deny) return deny;

  // 2) 입력 파라미터
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const ids = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : [];
  if (!ids.length) return NextResponse.json({ error: "ids required" }, { status: 400 });

  // 3) 스토리지 삭제용 경로 수집
  const { data: imgRows, error: readErr } = await admin
    .from("snacks")
    .select("id, image_path")
    .in("id", ids);
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  const paths = imgRows?.map(r => r.image_path).filter(Boolean) || [];

  // 4) 자식 테이블 정리 (스키마에 맞게 조정)
  const steps = await Promise.all([
    admin.from("snack_flavors_map").delete().in("snack_id", ids),
    admin.from("snack_keywords_map").delete().in("snack_id", ids),
    admin.from("snack_scores").delete().in("snack_id", ids),
    // admin.from("snack_likes").delete().in("snack_id", ids),
    // admin.from("reviews").delete().in("snack_id", ids),
  ]);
  const e = steps.find(s => s?.error)?.error;
  if (e) return NextResponse.json({ error: e.message }, { status: 500 });

  // 5) 본체 삭제
  const { error: delErr } = await admin.from("snacks").delete().in("id", ids);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  // 6) 스토리지 삭제
  if (paths.length) {
    await admin.storage.from("snack-images").remove(paths);
  }

  return NextResponse.json({ ok: true, deleted: ids });
}
