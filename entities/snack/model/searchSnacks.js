// entities/snack/model/searchSnacks.js
"use client";
import { getSupabaseClient } from "@shared/api/supabaseClient";

const PAGE_SIZE_DEFAULT = 20;

export async function searchSnacks({
  term = "",
  page = 1,
  pageSize = PAGE_SIZE_DEFAULT,
  operator = "and",
} = {}) {
  const client = getSupabaseClient();
  const norm = normalizeTerm(term);
  const tokens = tokenize(norm); // 공백 기반 토큰
  const op = (operator || "and").toLowerCase() === "or" ? "or" : "and";
  const { data: _typeNames } = tokens.length
    ? await client.from("snack_types").select("name").in("name", tokens)
    : { data: [] };
  const typeTokenSet = new Set((_typeNames || []).map(r => r.name));

  // ▶ term 없음 → 서버 페이지네이션
  if (tokens.length === 0) {
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

    return { items, page, totalPages: Math.max(1, Math.ceil((total || 0) / pageSize)), pageIds: ids };
  }

  // ▶ term 있음 → 토큰별 합집합 → 교집합 (정확/부분 일치)
  let idSetsPerToken = await Promise.all(tokens.map(t => getSnackIdSetForToken(client, t)));

  async function getSnackIdSetForTokenLev1(client, token, limit = 200) {
    const { data } = await client.rpc("search_snack_ids_lev1", { q: token, limit_n: limit });
    return new Set((data || []).map(r => r.snack_id));
  }
  
  // 짧은 토큰(≤3)은 fuzzy ∪ lev1을 항상 합집합으로 사용해 재현율 보강
  await Promise.all(idSetsPerToken.map(async (set, i) => {
    const tok = tokens[i];
    const isShort = [...tok].length <= 3;
    if (typeTokenSet.has(tok)) {
      return;
    }
    if (isShort) {
      const fuzzy = await getSnackIdSetForTokenFuzzy(client, tok, 200);
      const lev1  = await getSnackIdSetForTokenLev1(client, tok, 200);
      // 기존 정확/부분 일치 set ∪ fuzzy ∪ lev1
      idSetsPerToken[i] = unionSets(unionSets(set, fuzzy), lev1);
    } else if (set.size === 0) {
      // 긴 토큰은 예전처럼: 비었을 때만 fuzzy → 그래도 비면 lev1
      let s = await getSnackIdSetForTokenFuzzy(client, tok, 200);
      if (s.size === 0) s = await getSnackIdSetForTokenLev1(client, tok, 200);
      idSetsPerToken[i] = s;
    }
  }));

  // ▶ 결합 방식: AND = 교집합 / OR = 합집합
  let allIds = [];
  if (op === "or") {
    const uni = new Set();
    for (const s of idSetsPerToken) for (const v of s) uni.add(v);
    allIds = Array.from(uni);
  } else {
    let idSet = idSetsPerToken[0] || new Set();
    for (let i = 1; i < idSetsPerToken.length; i++) {
      idSet = intersectSets(idSet, idSetsPerToken[i]);
      if (idSet.size === 0) break;
    }
    allIds = Array.from(idSet);
  }

  // ▶ 스마트 2등분: 공백이 없고 AND 결과 0건 → 모든 2등분 시도
  if (op === "and" && allIds.length === 0 && !norm.includes(" ")) {
    const smartIds = await trySmartSplitIds(client, norm);
    if (smartIds.length > 0) allIds = smartIds;
  }

  // ▶ 전체문자열 폴백: 그래도 0건이면 느슨한 전체 문자열 매칭(상한 1000)
  if (allIds.length === 0) {
    const fbIds = await fallbackWholeStringIds(client, norm, 1000);
    if (fbIds.length > 0) allIds = fbIds;
  }

  // 페이지네이션(클라)
  const total = allIds.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageIds = allIds.slice(start, end);

  // 상세 + 태그 로드
  const { data: snackRows } = pageIds.length
    ? await client
        .from("snacks")
        .select("id,name,brand,slug,image_path,type:snack_types(id,name)")
        .in("id", pageIds)
    : { data: [] };

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

export async function loadSnackMetrics(snackIds = []) {
  if (!snackIds?.length) return { likesMap: {}, likedSet: new Set(), avgMap: {}, detailMap: {}, viewsMap: {}, commentsMap: {} };
  const client = getSupabaseClient();
  const avgMap = {};  // ✅ 추가

  const [{ data: sess }, { data: likeAgg }, { data: myLikes }, { data: scoreAgg }, { data: viewsAgg, error: viewsErr }] =
    await Promise.all([
      client.auth.getSession(),
      client.from("snack_likes_count").select("snack_id,likes_count").in("snack_id", snackIds),
      client.from("snack_likes").select("snack_id").in("snack_id", snackIds),
      client
        .from("snack_scores_avg")
        .select("snack_id,avg_tasty,avg_value,avg_plenty,avg_clean,avg_addictive,review_count")
        .in("snack_id", snackIds),
      // 선택: 조회수 집계 뷰가 있을 때만 성공, 없으면 무시
      client.from("snack_views_count").select("snack_id,views").in("snack_id", snackIds)
     
    ]);

  const likesMap = {};
  for (const r of likeAgg || []) likesMap[r.snack_id] = r.likes_count || 0;

  const uid = sess?.session?.user?.id || null;
  const likedSet = new Set(uid && myLikes ? myLikes.map(r => r.snack_id) : []);

  const detailMap  = {};
  for (const r of scoreAgg || []) {
    const c = Number(r.review_count) || 0;
    // 상세 맵: 항목별 평균 + 한줄평 수
    detailMap[r.snack_id] = {
      tasty: +r.avg_tasty || 0,
      value: +r.avg_value || 0,
      plenty: +r.avg_plenty || 0,
      clean: +r.avg_clean || 0,
      addictive: +r.avg_addictive || 0,
      review_count: c,
    };
    if (c > 0) {
      const mean =
        ((+r.avg_tasty || 0) +
          (+r.avg_value || 0) +
          (+r.avg_plenty || 0) +
          (+r.avg_clean || 0) +
          (+r.avg_addictive) || 0) / 5;
      avgMap[r.snack_id] = Number.isFinite(mean) ? +mean.toFixed(1) : undefined;
    }
  }
  const viewsMap = {};
  for (const v of viewsAgg || []) viewsMap[v.snack_id] = v.views || 0;

  const { data: ccRows } = await client
  .from("snack_comments_count")
  .select("snack_id, comments_count")
  .in("snack_id", snackIds);

  const commentsMap = {};
  for (const id of snackIds) commentsMap[id] = 0;
  for (const r of ccRows || []) commentsMap[r.snack_id] = r.comments_count || 0;

  return { likesMap, likedSet, avgMap, detailMap, viewsMap, commentsMap };
}

/* ───────────────────────── helpers ───────────────────────── */

function normalizeTerm(s) {
  return (s || "").trim().replace(/\s+/g, " ").slice(0, 200);
}
function tokenize(s) {
  if (!s) return [];
  return s.split(" ").filter(Boolean);
}
function intersectSets(a, b) {
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  const out = new Set();
  for (const v of small) if (large.has(v)) out.add(v);
  return out;
}

// 정확/부분 일치(현재 방식)
async function getSnackIdSetForToken(client, token) {
  const like = `%${token}%`;

  const { data: baseIds } = await client
    .from("snacks")
    .select("id")
    .eq("is_public", true)
    .or(`name.ilike.${like},brand.ilike.${like},slug.ilike.${like}`);

  const { data: typeRows } = await client
    .from("snack_types")
    .select("id")
    .eq("name", token);

  let typeSnackRows = [];
  if (typeRows?.length) {
    const { data } = await client
      .from("snacks")
      .select("id")
      .eq("is_public", true)
      .in("type_id", typeRows.map(r => r.id));
    typeSnackRows = data || [];

    return new Set((typeSnackRows || []).map(r => r.id));
  }

  const { data: fRows } = await client.from("snack_flavors").select("id").ilike("name", like);
  let flavorSnackRows = [];
  if (fRows?.length) {
    const { data } = await client
      .from("snack_flavors_map")
      .select("snack_id")
      .in("flavor_id", fRows.map(r => r.id));
    flavorSnackRows = (data || []).map(r => ({ id: r.snack_id }));
  }

  const { data: kRows } = await client
    .from("snack_keywords")
    .select("id")
    .eq("is_active", true)
    .ilike("name", like);
  let keywordSnackRows = [];
  if (kRows?.length) {
    const { data } = await client
      .from("snack_keywords_map")
      .select("snack_id")
      .in("keyword_id", kRows.map(r => r.id));
    keywordSnackRows = (data || []).map(r => ({ id: r.snack_id }));
  }

  return new Set([
    ...(baseIds || []).map(r => r.id),
    ...(typeSnackRows || []).map(r => r.id),
    ...(flavorSnackRows || []).map(r => r.id),
    ...(keywordSnackRows || []).map(r => r.id),
  ]);
}

function thresholdByLen(s) {
  const n = [...s].length;           // 유니코드 안전 길이
  if (n <= 3) return 0.18;           // 아주 짧은 토큰은 더 관대하게
  if (n <= 6) return 0.25;           // 기본(현재값)
  return 0.30;                       // 길면 조금 더 엄격
}

// 퍼지(오타 보정) — 빈 토큰에 한해 보강용으로 사용
async function getSnackIdSetForTokenFuzzy(client, token, limit = 200, _unused = 0.25) {
  const thresh = thresholdByLen(token);
  const { data } = await client.rpc("search_snack_ids_fuzzy", {
    q: token,
    limit_n: limit,
    sim_thresh: thresh
  });
  return new Set((data || []).map(r => r.snack_id));
}
// 공백 없는 입력에 대한 모든 2등분 시도
async function trySmartSplitIds(client, whole) {
  const s = whole.trim();
  if (s.length < 4) return []; // 너무 짧으면 패스
  const MIN = 2;
  const idsOut = new Set();

  for (let i = MIN; i <= s.length - MIN; i++) {
    const a = s.slice(0, i);
    const b = s.slice(i);
    const [setA, setB] = await Promise.all([
      getSnackIdSetForToken(client, a),
      getSnackIdSetForToken(client, b),
    ]);

    // 비어있으면 퍼지 보강
    const finalA = setA.size ? setA : await getSnackIdSetForTokenFuzzy(client, a, 200, 0.25);
    const finalB = setB.size ? setB : await getSnackIdSetForTokenFuzzy(client, b, 200, 0.25);

    const inter = intersectSets(finalA, finalB);
    if (inter.size > 0) {
      for (const v of inter) idsOut.add(v);
      break; // 첫 유효 분할을 채택
    }
  }
  return Array.from(idsOut);
}

// 전체 문자열 폴백(느슨한 부분매칭, 상한 적용)
async function fallbackWholeStringIds(client, whole, maxIds = 1000) {
  const like = `%${whole}%`;

  const [
    { data: baseRows },
    { data: typeRows },
    { data: flavorRows },
    { data: kwRows },
  ] = await Promise.all([
    client
      .from("snacks")
      .select("id")
      .eq("is_public", true)
      .or(`name.ilike.${like},brand.ilike.${like},slug.ilike.${like}`),
    client.from("snack_types").select("id").eq("name", whole),
    client.from("snack_flavors").select("id").ilike("name", like),
    client.from("snack_keywords").select("id").eq("is_active", true).ilike("name", like),
  ]);

  if (typeRows?.length) {
    const { data } = await client
      .from("snacks")
      .select("id")
      .eq("is_public", true)
      .in("type_id", typeRows.map(r => r.id));
    return (data || []).map(r => r.id).slice(0, Math.max(1, maxIds | 0));
  }
  const flavorSnackIds = (flavorRows?.length
    ? ((await client.from("snack_flavors_map").select("snack_id").in("flavor_id", flavorRows.map(r => r.id))).data || []).map(r => ({ id: r.snack_id }))
    : []);
  const kwSnackIds = (kwRows?.length
    ? ((await client.from("snack_keywords_map").select("snack_id").in("keyword_id", kwRows.map(r => r.id))).data || []).map(r => ({ id: r.snack_id }))
    : []);

  const set = new Set([
    ...(baseRows || []).map(r => r.id),
    ...flavorSnackIds.map(r => r.id),
    ...kwSnackIds.map(r => r.id),
  ]);

  return Array.from(set).slice(0, Math.max(1, maxIds | 0));
}

async function loadTags(client, ids) {
  const [{ data: fRows }, { data: kRows }] = await Promise.all([
    ids.length
      ? client.from("snack_flavors_map").select("snack_id, flavor:snack_flavors(id,name)").in("snack_id", ids)
      : { data: [] },
    ids.length
      ? client.from("snack_keywords_map").select("snack_id, kw:snack_keywords(id,name)").in("snack_id", ids)
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

function unionSets(a, b) {
  const out = new Set(a);
  for (const v of b) out.add(v);
  return out;
}