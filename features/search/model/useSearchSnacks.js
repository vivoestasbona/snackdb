// features/search/model/useSearchSnacks.js
"use client";
import { useEffect, useState } from "react";
import { searchSnacks, loadSnackMetrics } from "@entities/snack/model/searchSnacks";

export function useSearchSnacks({
  term = "",
  page = 1,
  pageSize = 20,
  operator = "and",
  sort = "relevance",        // relevance|likes|avg|facet|comments|views
  order = "desc"
} = {}) {
   const [state, setState] = useState({
    loading: true,
    items: [],
    page: 1,
    totalPages: 1,
    avgMap: {},
    likesMap: {},
    likedSet: new Set(),
  });

  const cmpBy = (items, maps) => {
    const { avgMap, likesMap, detailMap, commentsMap } = maps || {};
    // detailMap[snackId] = { tasty, value, plenty, clean, addictive, review_count }
    const safe = (n) => (Number.isFinite(+n) ? +n : -Infinity);
    const byComments = (id) => safe(commentsMap?.[id]);
    const byAvg = (id) => safe(avgMap?.[id]);
    const byLikes = (id) => safe(likesMap?.[id]);

    // 🔹 정확도 점수: 토큰이 name/brand/slug/타입/맛/키워드에 얼마나 “가깝게” 매칭되는지 가중치
    const tokens = (term || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
    const w = { eq: 100, starts: 60, incl: 40, brand: 25, type: 20, flavor: 15, keyword: 10 };
    const norm = (s) => (s || "").toString().toLowerCase();
    const scoreItem = (it) => {
      if (!tokens.length) return 0;
      const name = norm(it.name), brand = norm(it.brand), slug = norm(it.slug);
      const type = norm(it?.type?.name);
      const flavors = (it?.flavors || []).map(f => norm(f?.name));
      const keywords = (it?.keywords || []).map(k => norm(k?.name));
      let score = 0, matchedTokens = 0;
      for (const t of tokens) {
        let sTok = 0;
        if (name === t || slug === t) sTok = Math.max(sTok, w.eq);
        if (!sTok && (name.startsWith(t) || slug.startsWith(t))) sTok = Math.max(sTok, w.starts);
        if (!sTok && (name.includes(t) || slug.includes(t))) sTok = Math.max(sTok, w.incl);
        if (!sTok && brand && brand.includes(t)) sTok = Math.max(sTok, w.brand);
        if (!sTok && type && type.includes(t)) sTok = Math.max(sTok, w.type);
        if (!sTok && flavors.some(v => v.includes(t))) sTok = Math.max(sTok, w.flavor);
        if (!sTok && keywords.some(v => v.includes(t))) sTok = Math.max(sTok, w.keyword);
        if (sTok > 0) { score += sTok; matchedTokens++; }
      }
      // 모든 토큰이 한 번씩이라도 맞으면 보너스
      if (matchedTokens === tokens.length) score += 50;
      return score;
    };

    const sorted = [...items];
    switch (sort) {
      case "relevance":
        sorted.sort((a, b) => scoreItem(b) - scoreItem(a));
        break;
      case "likes":
        sorted.sort((a, b) => byLikes(b.id) - byLikes(a.id));
        break;
      case "avg":
        sorted.sort((a, b) => byAvg(b.id) - byAvg(a.id));
        break;
      case "comments":
        sorted.sort((a, b) => byComments(b.id) - byComments(a.id));
        break;
      case "tasty":
        sorted.sort((a, b) => (detailMap?.[b.id]?.tasty || 0) - (detailMap?.[a.id]?.tasty || 0));
        break;
      case "value":
        sorted.sort((a, b) => (detailMap?.[b.id]?.value || 0) - (detailMap?.[a.id]?.value || 0));
        break;
      case "plenty":
        sorted.sort((a, b) => (detailMap?.[b.id]?.plenty || 0) - (detailMap?.[a.id]?.plenty || 0));
        break;
      case "clean":
        sorted.sort((a, b) => (detailMap?.[b.id]?.clean || 0) - (detailMap?.[a.id]?.clean || 0));
        break;
      case "addictive":
        sorted.sort((a, b) => (detailMap?.[b.id]?.addictive || 0) - (detailMap?.[a.id]?.addictive || 0));
        break;
      default:
      // 과거 링크로 sort=name/recent가 들어와도 정확도순으로 동작
        sorted.sort((a, b) => scoreItem(b) - scoreItem(a));
        break;
    }
    if (order === "asc") sorted.reverse();
    return sorted;
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setState((s) => ({ ...s, loading: true }));
      try {
        // 🔹 operator 전달
        const { items, page: p, totalPages, pageIds } = await searchSnacks({ term, page, pageSize, operator });

        let avgMap = {}, likesMap = {}, likedSet = new Set(), detailMap = {}, commentsMap = {};
        if (pageIds?.length) {
          const m = await loadSnackMetrics(pageIds);
          avgMap = m.avgMap; likesMap = m.likesMap; likedSet = m.likedSet;
          detailMap = m.detailMap || {};
          commentsMap = m.commentsMap || {};
        }
        const sortedItems = cmpBy(items, { avgMap, likesMap, detailMap, commentsMap });
        if (!alive) return;
        setState({ loading: false, items: sortedItems, page: p, totalPages, avgMap, likesMap, likedSet });
      } catch (e) {
        if (!alive) return;
        setState((s) => ({ ...s, loading: false, items: [], totalPages: 1 }));
        console.error(e);
      }
    })();
    // 🔹 op/sort/facet 변경 시에도 다시 호출
  }, [term, page, pageSize, operator, sort, order]);

  return state;
}
