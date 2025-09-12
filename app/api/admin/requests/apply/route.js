import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@shared/api/supabaseAdmin";

function j(status, obj) { return NextResponse.json(obj, { status }); }

export async function POST(req) {
  const step = (s, extra={}) => ({ step: s, ...extra });

function makeSlug(s, fallback = "kw") {
  const base = String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣\-]/g, "")      // 한글/영문/숫자/하이픈만
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || fallback;
}

const TBL = {
    typeMaster: "snack_types",
    flavorMaster: "snack_flavors",
    flavorMap: "snack_flavors_map",
    keywordMaster: "snack_keywords",
    keywordMap: "snack_keywords_map",
    };

async function findIdByName(admin, table, name) {
  const nm = String(name || "").trim();
  if (!nm) return null;
  const q = await admin.from(table).select("id").ilike("name", nm).maybeSingle();
  if (q.error) throw new Error(`findIdByName(${table}): ${q.error.message}`);
  return q.data?.id ?? null;
}

// opts.withSlug=true면 {name, slug}로 insert
async function ensureIdByName(admin, table, name, opts = {}) {
  const nm = String(name || "").trim();
  if (!nm) return null;

  // 1) 이름으로 먼저 찾아보기
  const found = await findIdByName(admin, table, nm);
  if (found) return found;

  // 2) 삽입
  const withSlug = !!opts.withSlug;
  let payload = { name: nm };

  if (withSlug) {
    const slug0 = makeSlug(nm, opts.slugFallback || "kw");
    const slug = await ensureUniqueSlug(admin, table, slug0);
    payload = { ...payload, slug };
  }

  const ins = await admin.from(table).insert(payload).select("id").maybeSingle();
  if (ins.error || !ins.data) {
    throw new Error(`ensureIdByName(${table} ins): ${ins.error?.message || "insert failed"}`);
  }
  return ins.data.id;
}


async function ensureUniqueSlug(admin, table, slug) {
  const base = slug;
  for (let i = 0; i < 200; i++) {
    const cand = i === 0 ? base : `${base}-${i + 2}`;
    const { data, error } = await admin.from(table).select("id").eq("slug", cand).maybeSingle();
    if (!error && !data) return cand;
  }
  throw new Error(`slug unique fail for ${table}:${slug}`);
}


  // 0) Admin 클라이언트/ENV 확인
  const admin = getSupabaseAdmin?.();
  if (!admin) return j(500, step("init_admin", { error: "getSupabaseAdmin() returned null" }));
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return j(500, step("env_url_missing", { error: "NEXT_PUBLIC_SUPABASE_URL missing" }));
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return j(500, step("env_service_key_missing", { error: "SUPABASE_SERVICE_ROLE_KEY missing" }));

  // 1) 관리자 인증 (Bearer 토큰 + profiles.role=admin)
  try {
    const auth = req.headers.get("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return j(401, step("auth_header", { error: "authorization header missing" }));

    const { data: u, error: ue } = await admin.auth.getUser(token);
    if (ue || !u?.user?.id) return j(401, step("auth_getUser", { error: ue?.message || "invalid token" }));

    const { data: prof, error: pe } = await admin
      .from("profiles")
      .select("role")
      .eq("id", u.user.id)
      .maybeSingle();
    if (pe) return j(500, step("auth_profile_query", { error: pe.message }));
    if (prof?.role !== "admin") return j(403, step("auth_role", { error: "forbidden: role != admin" }));
  } catch (e) {
    return j(500, step("auth_block", { error: String(e?.message || e) }));
  }

  // 2) 입력 파싱
  let body = {};
  try { body = await req.json(); } catch {}
  const id = body?.id;
  if (!id) return j(400, step("parse_body", { error: "missing id" }));

  // 3) 요청/스낵 로드
  let r, snack;
  
  try {
    const rq = await admin.from("snack_tag_requests").select("*").eq("id", id).maybeSingle();
    if (rq.error || !rq.data) return j(404, step("load_request", { error: rq.error?.message || "request not found" }));
    r = rq.data;

    const sq = await admin.from("snacks").select("id, slug, type_id").eq("id", r.snack_id).maybeSingle();
    if (sq.error || !sq.data) return j(404, step("load_snack", { error: sq.error?.message || "snack not found" }));
    snack = sq.data;
  } catch (e) {
    return j(500, step("load_block", { error: String(e?.message || e) }));
  }

  // 승인 시 상태 가드: pending만 허용 (요청 로드 이후로 이동)
 if (r.status !== "pending") {
   return j(409, step("apply_guard_status", { error: "only pending requests can be approved" }));
 }

 // 변경 통계
 const stats = { add_flavors: 0, remove_flavors: 0, add_keywords: 0, remove_keywords: 0, add_type: 0 };

  // 5) 반영
  try {
    // 타입(단일)
    if (Array.isArray(r.add_types) && r.add_types.length > 0) {
      const toId = await ensureIdByName(admin, TBL.typeMaster, r.add_types[0], { withSlug: false });
      if (toId && toId !== snack.type_id) {                 // 같으면 No-op
        const up = await admin.from("snacks").update({ type_id: toId }).eq("id", r.snack_id).select("id").maybeSingle();
        if (up.data) stats.add_type = 1;
      }
    }
    if (Array.isArray(r.remove_types) && r.remove_types.length > 0 && snack.type_id) {
      const cur = await admin.from(TBL.typeMaster).select("name").eq("id", snack.type_id).maybeSingle();
      if (cur.error) throw new Error(`get type name: ${cur.error.message}`);
      if (cur.data && r.remove_types.some(n => String(n).toLowerCase() === cur.data.name.toLowerCase())) {
        const up = await admin.from("snacks").update({ type_id: null }).eq("id", r.snack_id).select("id").maybeSingle();
        if (up.data) stats.add_type = 0; // 타입 해제는 카운트에 포함하지 않음(원하면 별도 통계 추가)
      }
    }

    // 6) 맛(다중) — 마스터: snack_flavors, 매핑: snack_flavors_map
    if (Array.isArray(r.add_flavors)) {
      for (const name of r.add_flavors) {
        const fid = await ensureIdByName(admin, TBL.flavorMaster, name, { withSlug: false });
        if (fid) {
          const up = await admin.from("snack_flavors_map")
           .upsert({ snack_id: r.snack_id, flavor_id: fid }, { onConflict: "snack_id,flavor_id", ignoreDuplicates: true })
           .select("snack_id");                               // 실제로 새로 추가됐는지 확인
          if (up.error) throw new Error(`add flavor '${name}': ${up.error.message}`);
          if (up.data?.length) stats.add_flavors += up.data.length;
        }
      }
    }
    if (Array.isArray(r.remove_flavors)) {
      for (const name of r.remove_flavors) {
        const fid = await findIdByName(admin, TBL.flavorMaster, name);
        if (fid) {
          const del = await admin.from("snack_flavors_map").delete().match({ snack_id: r.snack_id, flavor_id: fid }).select("snack_id");
          if (del.data?.length) stats.remove_flavors += del.data.length;
        }
      }
    }

    // 7) 키워드(다중) — 마스터: snack_keywords, 매핑: snack_keywords_map
    if (Array.isArray(r.add_keywords)) {
      for (const name of r.add_keywords) {
        const kid = await ensureIdByName(admin, TBL.keywordMaster, name, { withSlug: true, slugFallback: "kw" });
        if (kid) {
            const up = await admin.from("snack_keywords_map")
                .upsert({ snack_id: r.snack_id, keyword_id: kid }, { onConflict: "snack_id,keyword_id", ignoreDuplicates: true })
                .select("snack_id");
            if (up.data?.length) stats.add_keywords += up.data.length;
        }
      }
    }
    if (Array.isArray(r.remove_keywords)) {
      for (const name of r.remove_keywords) {
        const kid = await findIdByName(admin, TBL.keywordMaster, name);
        if (kid) {
          const del = await admin.from("snack_keywords_map").delete().match({ snack_id: r.snack_id, keyword_id: kid }).select("snack_id");
          if (del.data?.length) stats.remove_keywords += del.data.length;
        }
      }
    }
  } catch (e) {
    return j(500, step("apply_changes", { error: String(e?.message || e) }));
  }

  const total = Object.values(stats).reduce((a, b) => a + b, 0);

  // 6) 캐시 무효화
  try {
    if (snack.slug) revalidatePath(`/snacks/${snack.slug}`);
  } catch (e) {
    // 캐시 무효화 실패는 치명적이지 않음 → 경고만 전달
    return j(200, step("done_warn_revalidate", { ok: true, slug: snack.slug, stats, total, warn: String(e?.message || e) }));
  }

  return j(200, step("done", { ok: true, slug: snack.slug, stats, total }));
}
