// features/manage-snack-categories/model/useAvailableTypes.js
"use client";
import { useEffect, useState } from "react";

/** 선택한 맛(AND/OR) 기준으로 가능한 type_id 분포를 돌려주는 훅 */
export function useAvailableTypes(selectedFlavorIds = [], op = "and") {
  const [countsMap, setCountsMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ op: (op || "and").toLowerCase() });
        if (selectedFlavorIds?.length) qs.set("selected", selectedFlavorIds.join(","));
        const res = await fetch(`/api/types/available?${qs.toString()}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "API error");
        if (alive) setCountsMap(json.counts || {});
      } catch (err) {
        if (alive) setError(err);
        if (alive) setCountsMap({});
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [op, JSON.stringify(selectedFlavorIds)]);

  return { countsMap, loading, error };
}
