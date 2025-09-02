// widgets/snack-preview/ui/AdminPreview.jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@shared/api/supabaseClient";
import SnackDetailView from "./SnackDetailView";

function calcAvg(rows) {
  if (!rows?.length) return null;
  const s = rows.reduce(
    (a, r) => ({
      tasty: a.tasty + r.tasty,
      value: a.value + r.value,
      plenty: a.plenty + r.plenty,
      clean: a.clean + r.clean,
      addictive: a.addictive + r.addictive,
    }),
    { tasty: 0, value: 0, plenty: 0, clean: 0, addictive: 0 }
  );
  const n = rows.length;
  return {
    tasty: s.tasty / n,
    value: s.value / n,
    plenty: s.plenty / n,
    clean: s.clean / n,
    addictive: s.addictive / n,
    count: n,
  };
}

export default function AdminPreview({ slug }) {
  const sb = getSupabaseClient();
  const router = useRouter();
  const [state, setState] = useState({ 
    snack: null, avg: null, flavors: [], keywords: [], loading: true
   });

  useEffect(() => {
    let alive = true;
    (async () => {
      // 1) 로그인 + 관리자 확인
      const { data: sess } = await sb.auth.getSession();
      const uid = sess?.session?.user?.id;
      if (!uid) { router.replace(`/snacks/${slug}`); return; }

      const { data: prof } = await sb
        .from("profiles")
        .select("role")
        .eq("id", uid)
        .single();

      if (prof?.role !== "admin") { router.replace(`/snacks/${slug}`); return; }

      // 2) 스낵 기본(+type) + 평균
      const { data: snack } = await sb
        .from("snacks")
        .select("id, name, brand, image_path, slug, is_public, created_at, updated_at, type:snack_types(id, name)")
        .eq("slug", decodeURIComponent(slug))
        .maybeSingle();
      if (!snack) { router.replace(`/`); return; }

      const { data: rows } = await sb
        .from("snack_scores")
        .select("tasty, value, plenty, clean, addictive")
        .eq("snack_id", snack.id);

        // 3) 맛/키워드 매핑
      const { data: flavorRows = [] } = await sb
        .from("snack_flavors_map")
        .select("flavor:snack_flavors(id, name)")
        .eq("snack_id", snack.id);
      const { data: keywordRows = [] } = await sb
        .from("snack_keywords_map")
        .select("keyword:snack_keywords(id, name)")
        .eq("snack_id", snack.id);

      if (!alive) return;
      setState({
        snack: { ...snack, type: snack.type ?? null },
        avg: calcAvg(rows || []),
        flavors: flavorRows.map(f => f.flavor).filter(Boolean),
        keywords: keywordRows.map(k => k.keyword).filter(Boolean),
        loading: false
      });
    })();
    return () => { alive = false; };
  }, [sb, slug, router]);

  if (state.loading) return null;

  const { snack, avg, flavors, keywords } = state;
  return (
    <SnackDetailView
      preview
      snack={snack}
      avg={avg}
      flavors={flavors}
      keywords={keywords}
    />
  );
}
