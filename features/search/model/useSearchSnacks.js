// features/search/model/useSearchSnacks.js
"use client";
import { useEffect, useState } from "react";
import { searchSnacks, loadSnackMetrics } from "@entities/snack/model/searchSnacks";

export function useSearchSnacks({ term = "", page = 1, pageSize = 20, operator = "and" } = {}) {
  const [state, setState] = useState({
    loading: true,
    items: [],
    page: 1,
    totalPages: 1,
    avgMap: {},
    likesMap: {},
    likedSet: new Set(),
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      setState((s) => ({ ...s, loading: true }));
      try {
        // 🔹 operator 전달
        const { items, page: p, totalPages, pageIds } = await searchSnacks({ term, page, pageSize, operator });

        let avgMap = {}, likesMap = {}, likedSet = new Set();
        if (pageIds?.length) {
          const m = await loadSnackMetrics(pageIds);
          avgMap = m.avgMap; likesMap = m.likesMap; likedSet = m.likedSet;
        }
        if (!alive) return;
        setState({ loading: false, items, page: p, totalPages, avgMap, likesMap, likedSet });
      } catch (e) {
        if (!alive) return;
        setState((s) => ({ ...s, loading: false, items: [], totalPages: 1 }));
        console.error(e);
      }
    })();
    // 🔹 op 변경 시도에도 다시 호출
  }, [term, page, pageSize, operator]);

  return state;
}
