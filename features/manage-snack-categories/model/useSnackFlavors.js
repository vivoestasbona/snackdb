"use client";
import { useCallback, useEffect, useState } from "react";
import { getSnackFlavors } from "@entities/snack/model/getSnackFlavors";

export function useSnackFlavors({ skip = false } = {}) {
  const [flavors, setFlavors] = useState([]);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getSnackFlavors();
      setFlavors(rows);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!skip) refresh(); }, [skip, refresh]);
  return { flavors, loading, error, refresh };
}
