"use client";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import RadarChart from "./RadarChart";

export default function RadarWithUser({ snackId, avg: initialAvg }) {
  const sb = getSupabaseClient();
  const [mine, setMine] = useState(null);
  const [avg, setAvg]   = useState(initialAvg);

  // 내 점수 로드
  async function loadMine() {
    const { data: sess } = await sb.auth.getSession();
    const uid = sess?.session?.user?.id;
    if (!uid) { setMine(null); return; }

    const { data, error } = await sb
      .from("snack_scores")
      .select("tasty,value,plenty,clean,addictive")
      .eq("snack_id", snackId)
      .eq("user_id", uid)
      .maybeSingle();

    if (!error) setMine(data || null);
  }

  // 평균 재계산
  async function recomputeAvg() {
    const { data: rows, error } = await sb
      .from("snack_scores")
      .select("tasty,value,plenty,clean,addictive")
      .eq("snack_id", snackId);

    if (error) { console.error("[avg recompute]", error.message); return; }

    if (!rows?.length) {
      setAvg({ tasty:0, value:0, plenty:0, clean:0, addictive:0, count:0 });
      return;
    }

    const sum = rows.reduce(
      (a, r) => ({
        tasty: a.tasty + (r.tasty ?? 0),
        value: a.value + (r.value ?? 0),
        plenty: a.plenty + (r.plenty ?? 0),
        clean: a.clean + (r.clean ?? 0),
        addictive: a.addictive + (r.addictive ?? 0),
      }),
      { tasty:0, value:0, plenty:0, clean:0, addictive:0 }
    );

    const n = rows.length;
    setAvg({
      tasty: sum.tasty / n,
      value: sum.value / n,
      plenty: sum.plenty / n,
      clean: sum.clean / n,
      addictive: sum.addictive / n,
      count: n,
    });
  }

  // 초기 로드 + 저장 이벤트에 반응해 mine/avg 동시 갱신
  useEffect(() => {
    loadMine();
    recomputeAvg();

    const onUpdated = (e) => {
      if (e.detail?.snackId === snackId) {
        loadMine();
        recomputeAvg();
      }
    };
    window.addEventListener("snack:review-updated", onUpdated);
    return () => window.removeEventListener("snack:review-updated", onUpdated);
  }, [snackId]);

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
