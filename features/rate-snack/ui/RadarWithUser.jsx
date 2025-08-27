// features/rate-snack/ui/RadarWithUser.jsx

"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { getSupabaseClient } from "@shared/api/supabaseClient";
import RadarChart from "@features/rate-snack/ui/RadarChart";
import { calcAverageFromRows } from "@features/rate-snack/model/calcStats";

export default function RadarWithUser({ snackId, avg: initialAvg }) {
  const sb = getSupabaseClient();
  const [mine, setMine] = useState(null);
  const [avg, setAvg]   = useState(initialAvg);
  const mounted = useRef(true);

  const loadMine = useCallback(async () => {
    const { data: sess } = await sb.auth.getSession();
    const uid = sess?.session?.user?.id;
    if (!uid) { if (mounted.current) setMine(null); return; }

    const { data, error } = await sb
      .from("snack_scores")
      .select("tasty,value,plenty,clean,addictive")
      .eq("snack_id", snackId)
      .eq("user_id", uid)
      .maybeSingle();

    if (!error && mounted.current) setMine(data || null);
  }, [sb, snackId]);

  const recomputeAvg = useCallback(async () => {
    const { data: rows, error } = await sb
      .from("snack_scores")
      .select("tasty,value,plenty,clean,addictive")
      .eq("snack_id", snackId);

    if (error) { console.error("[avg recompute]", error.message); return; }
    const next = calcAverageFromRows(rows) || { tasty:0, value:0, plenty:0, clean:0, addictive:0, count:0 };
    if (mounted.current) setAvg(next);
  }, [sb, snackId]);

  // 초기 로드 + 저장 이벤트에 반응해 mine/avg 동시 갱신
  useEffect(() => {
    mounted.current = true;
    loadMine();
    // SSR로 avg가 왔으면 첫 렌더엔 재계산 생략 → 중복 쿼리 방지
    if (!initialAvg) recomputeAvg();

    const onUpdated = (e) => {
      if (e.detail?.snackId === snackId) {
        loadMine();
        recomputeAvg();
      }
    };
    window.addEventListener("snack:review-updated", onUpdated);
    return () => {
      mounted.current = false;
      window.removeEventListener("snack:review-updated", onUpdated);
    };
  }, [snackId, initialAvg, loadMine, recomputeAvg]);

  //  로그아웃 시 오버레이를 즉시 숨김 (표시만 정리)
  useEffect(() => {
    const { data: sub } = sb.auth.onAuthStateChange((_event, sess) => {
      if (!sess) {
        setMine(null);      // 방금 로그아웃됨 → 내 점수 오버레이 제거
        // 평균은 SSR 값이면 유지. 원하면 여기서 recomputeAvg()도 호출 가능
      }
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, [sb]);

  return <RadarChart values={avg} overlay={mine} />;
}
