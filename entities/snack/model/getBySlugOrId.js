// entities/snack/model/getBySlugOrId.js
import { getSupabaseServer } from "@shared/api/supabase/server";
import { permanentRedirect } from "next/navigation";

/**
 * slug 또는 id로 과자를 조회하고, 평균 점수도 계산
 */
export async function getBySlugOrId(slugOrId) {
  const sb = getSupabaseServer();

  // URL 파라미터 디코딩 + 정규화
  const key = decodeURIComponent(slugOrId || "");
  const normalized = key
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-+|-+$)/g, "");

  // 1) slug 매칭
  let { data: snack, error } = await sb
    .from("snacks")
    .select("id, name, brand, image_path, slug")
    .eq("slug", key)
    .eq("is_public", true)
    .maybeSingle();
  if (error) console.error("[snacks by slug] error:", error);

  // 2) 정규화 slug 매칭
  if (!snack && normalized !== key) {
    const { data: alt, error: e2 } = await sb
      .from("snacks")
      .select("id, name, brand, image_path, slug")
      .eq("slug", normalized)
      .eq("is_public", true)
      .maybeSingle();
    if (e2) console.error("[snacks by normalized slug] error:", e2);
    if (alt) snack = alt;
  }

  // 3) UUID 접근 시 slug 리다이렉트
  if (!snack && /^[0-9a-f-]{36}$/i.test(key)) {
    const { data: byId } = await sb
      .from("snacks")
      .select("id, name, brand, image_path, slug")
      .eq("id", key)
      .eq("is_public", true)
      .maybeSingle();
    if (byId?.slug) {
      permanentRedirect(`/snacks/${encodeURIComponent(byId.slug)}`);
    }
  }

  if (!snack) return { snack: null, avg: null };

  const { data: rows } = await sb
    .from("snack_scores")
    .select("tasty, value, plenty, clean, addictive")
    .eq("snack_id", snack.id);

  const { calcAverageFromRows } = await import("@features/rate-snack/model/calcStats");
  const avg = calcAverageFromRows(rows);
  return { snack, avg };
}
