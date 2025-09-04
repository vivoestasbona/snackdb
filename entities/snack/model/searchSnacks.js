// entities/snack/model/searchSnacks.js
"use client";
import { getSupabaseClient } from "@shared/api/supabaseClient";

const PAGE_SIZE_DEFAULT = 20;

/**
 * term 이 없으면 서버 페이지네이션,
 * term 이 있으면 (본문/종류/맛/키워드)에서 합집합 ID → 클라 페이지네이션.
 * 반환: { items, page, totalPages, pageIds }
 * items: [{ id,name,brand,slug,image_path, type:{id,name}, flavors:[{id,name}], keywords:[{id,name}] }]
 */
export async function searchSnacks({ term = "", page = 1, pageSize = PAGE_SIZE_DEFAULT } = {}) {
  const client = getSupabaseClient();
  const like = `%${term}%`;

  // ─────────────────────────────────────────
  // term 없음 → 서버 페이지네이션
  // ─────────────────────────────────────────
  if (!term) {
    const { data: rows, error, count: total } = await client
      .from("snacks")
      .select("id,name,brand,slug,image_path,type:snack_types(id,name)", { count: "exact" })
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) throw error;
    const ids = (rows || []).map(r => r.id);
    const { flavorsBySnack, keywordsBySnack } = await loadTags(client, ids);

    const items = (rows || []).map(s => ({
      ...s,
      flavors: flavorsBySnack[s.id] || [],
      keywords: keywordsBySnack[s.id] || [],
    }));

    return {
      items,
      page,
      totalPages: Math.max(1, Math.ceil((total || 0) / pageSize)),
      pageIds: ids,
    };
  }

  // ─────────────────────────────────────────
  // term 있음 → 합집합 ID → 클라 페이지네이션
  // ─────────────────────────────────────────
  const [{ data: baseIds }, { data: typeIds }, { data: flavorIds }, { data: kwIds }] =
    await Promise.all([
      client
        .from("snacks")
        .select("id")
        .eq("is_public", true)
        .or(`name.ilike.${like},brand.ilike.${like},slug.ilike.${like}`),

      // type.name
      (async () => {
        const { data: typeRows } = await client.from("snack_types").select("id").ilike("name", like);
        if (!typeRows?.length) return { data: [] };
        const { data: rows } = await client
          .from("snacks")
          .select("id")
          .eq("is_public", true)
          .in("type_id", typeRows.map(r => r.id));
        return { data: rows || [] };
      })(),

      // flavor.name
      (async () => {
        const { data: fRows } = await client.from("snack_flavors").select("id").ilike("name", like);
        if (!fRows?.length) return { data: [] };
        const { data: rows } = await client
          .from("snack_flavors_map")
          .select("snack_id")
          .in("flavor_id", fRows.map(r => r.id));
        return { data: rows?.map(r => ({ id: r.snack_id })) || [] };
      })(),

      // keyword.name
      (async () => {
        const { data: kRows } = await client
          .from("snack_keywords")
          .select("id")
          .eq("is_active", true)
          .ilike("name", like);
        if (!kRows?.length) return { data: [] };
        const { data: rows } = await client
          .from("snack_keywords_map")
          .select("snack_id")
          .in("keyword_id", kRows.map(r => r.id));
        return { data: rows?.map(r => ({ id: r.snack_id })) || [] };
      })(),
    ]);

  const idSet = new Set([
    ...(baseIds || []).map(r => r.id),
    ...(typeIds || []).map(r => r.id),
    ...(flavorIds || []).map(r => r.id),
    ...(kwIds || []).map(r => r.id),
  ]);
  const allIds = Array.from(idSet);

  const total = allIds.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageIds = allIds.slice(start, end);

  const { data: snackRows } = pageIds.length
    ? await client
        .from("snacks")
        .select("id,name,brand,slug,image_path,type:snack_types(id,name)")
        .in("id", pageIds)
    : { data: [] };

  // IN 결과 재정렬
  const byId = new Map((snackRows || []).map(r => [r.id, r]));
  const ordered = pageIds.map(id => byId.get(id)).filter(Boolean);

  const { flavorsBySnack, keywordsBySnack } = await loadTags(client, pageIds);

  const items = ordered.map(s => ({
    ...s,
    flavors: flavorsBySnack[s.id] || [],
    keywords: keywordsBySnack[s.id] || [],
  }));

  return { items, page, totalPages, pageIds };
}

/** 좋아요/내 좋아요/평균점수 집계 */
export async function loadSnackMetrics(snackIds = []) {
  if (!snackIds?.length) return { likesMap: {}, likedSet: new Set(), avgMap: {} };
  const client = getSupabaseClient();

  const [{ data: sess }, { data: likeAgg }, { data: myLikes }, { data: scoreAgg }] =
    await Promise.all([
      client.auth.getSession(),
      client.from("snack_likes_count").select("snack_id,likes_count").in("snack_id", snackIds),
      client.from("snack_likes").select("snack_id").in("snack_id", snackIds),
      client
        .from("snack_scores_avg")
        .select("snack_id,avg_tasty,avg_value,avg_plenty,avg_clean,avg_addictive,review_count")
        .in("snack_id", snackIds),
    ]);

  const likesMap = {};
  for (const r of likeAgg || []) likesMap[r.snack_id] = r.likes_count || 0;

  const uid = sess?.session?.user?.id || null;
  const likedSet = new Set(uid && myLikes ? myLikes.map(r => r.snack_id) : []);

  const avgMap = {};
  for (const r of scoreAgg || []) {
    const c = Number(r.review_count) || 0;
    if (c > 0) {
      const mean =
        ((+r.avg_tasty || 0) +
          (+r.avg_value || 0) +
          (+r.avg_plenty || 0) +
          (+r.avg_clean || 0) +
          (+r.avg_addictive || 0)) / 5;
      avgMap[r.snack_id] = Number.isFinite(mean) ? +mean.toFixed(1) : undefined;
    }
  }
  return { likesMap, likedSet, avgMap };
}

/** 태그 일괄 로드 */
async function loadTags(client, ids) {
  const [{ data: fRows }, { data: kRows }] = await Promise.all([
    ids.length
      ? client
          .from("snack_flavors_map")
          .select("snack_id, flavor:snack_flavors(id,name)")
          .in("snack_id", ids)
      : { data: [] },
    ids.length
      ? client
          .from("snack_keywords_map")
          .select("snack_id, kw:snack_keywords(id,name)")
          .in("snack_id", ids)
      : { data: [] },
  ]);

  const flavorsBySnack = group(fRows, "snack_id", "flavor");
  const keywordsBySnack = group(kRows, "snack_id", "kw");
  return { flavorsBySnack, keywordsBySnack };
}

function group(rows = [], key, val) {
  const m = {};
  for (const r of rows || []) {
    const k = r?.[key];
    const v = r?.[val];
    if (!k || !v) continue;
    (m[k] ||= []).push(v);
  }
  return m;
}
