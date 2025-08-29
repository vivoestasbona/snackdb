"use client";
import { getSupabaseClient } from "@shared/api/supabaseClient";

export async function ensureKeywords(names = []) {
  const client = getSupabaseClient();
  const ids = [];
  for (const raw of names) {
    const nm = normalize(raw);
    if (!nm) continue;

    // 1) 후보 조회 후 JS에서 정확 매칭(대소문자 무시)
    const { data: candidates, error: findErr } = await client
      .from("snack_keywords")
      .select("id,name")
      .eq("is_active", true)
      .ilike("name", `%${nm}%`)
      .limit(10);
    if (findErr) { console.error("[kw find]", findErr); }
    const exact = (candidates || []).find(r => (r.name||"").toLowerCase() === nm.toLowerCase());
    let id = exact?.id;

    // 2) 없으면 생성
    if (!id) {
        // 한글 등 비영문 입력일 때 slugify가 빈 문자열이 되는 문제 방지
        let slug = slugify(nm);
        if (!slug) slug = nm;                 // ← 유니코드 슬러그 허용 (가장 간단/안전)
        // 필요하면 encodeURIComponent(nm)로도 가능: slug = encodeURIComponent(nm).replace(/%/g,"");

      const { data: created, error: cErr } = await client
        .from("snack_keywords")
        .insert([{ name: nm, slug }])
        .select("id")
        .single();

      if (cErr) {
        if (cErr.code === "23505") {
          // 경합 시 재조회
          const { data: again } = await client
            .from("snack_keywords")
            .select("id,name")
            .ilike("name", nm)
            .limit(1);
          id = again?.[0]?.id;
        } else {
          console.error("[kw insert]", cErr); // 디버그에 도움
          throw cErr;
        }
      } else {
        id = created?.id;
      }
    }
    if (id) ids.push(id);
  }
  return ids;
}

function normalize(s){ return (s||"").trim().replace(/\s+/g," "); }
function slugify(s){
  return (s||"").trim().toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-")
    .replace(/(^-+|-+$)/g,"");
}
