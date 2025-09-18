"use client";
import { useCallback, useEffect, useState } from "react";
import { getSnackTypes } from "@entities/snack/model/getSnackTypes";

export function useSnackTypes({ skip = false } = {}) {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getSnackTypes();
      setTypes(rows);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!skip) refresh(); }, [skip, refresh]);
  return { types, loading, error, refresh };
}
