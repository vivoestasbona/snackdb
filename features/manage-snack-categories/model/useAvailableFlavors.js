// features/manage-snack-categories/model/useAvailableFlavors.js
"use client";
import { useEffect, useState } from "react";

/**
 * typeId가 없어도 동작. 선택한 맛(selectedFlavorIds)과 op("and"|"or")를 API로 전달.
 * 반환: { countsMap: { [flavor_id]: number }, loading, error }
 */
export function useAvailableFlavors(typeId, selectedFlavorIds = [], op = "and") {
  const [countsMap, setCountsMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ op: op || "and" });
        if (typeId) qs.set("typeId", typeId);
        if (selectedFlavorIds?.length) {
          qs.set("selected", selectedFlavorIds.join(","));
        }
        const res = await fetch(`/api/flavors/available?${qs.toString()}`);
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

    return () => {
      alive = false;
    };
  }, [typeId, op, JSON.stringify(selectedFlavorIds)]);

  return { countsMap, loading, error };
}

