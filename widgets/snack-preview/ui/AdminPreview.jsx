// widgets/snack-preview/ui/AdminPreview.jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@shared/api/supabaseClient";
import LikeButton from "@features/like-snack/ui/LikeButton";
import RadarWithUser from "@features/rate-snack/ui/RadarWithUser";
import OneLiners from "@entities/review/ui/OneLiners";

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
  const [state, setState] = useState({ snack: null, avg: null, loading: true });

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

      // 2) 비공개 포함해서 스낵/평균 가져오기 (is_public 필터 없음)
      const { data: snack } = await sb
        .from("snacks")
        .select("id, name, brand, image_path, slug, is_public, created_at, updated_at")
        .eq("slug", decodeURIComponent(slug))
        .maybeSingle();

      if (!snack) { router.replace(`/`); return; }

      const { data: rows } = await sb
        .from("snack_scores")
        .select("tasty, value, plenty, clean, addictive")
        .eq("snack_id", snack.id);

      if (!alive) return;
      setState({ snack, avg: calcAvg(rows || []), loading: false });
    })();
    return () => { alive = false; };
  }, [sb, slug, router]);

  if (state.loading) return null;

  const { snack, avg } = state;
  const imgUrl = snack.image_path
    ? `/api/images/snack?path=${encodeURIComponent(snack.image_path)}`
    : null;

  return (
    <section className="snack-wrap">
      <aside className="snack-left">
        <div className="preview-badge">관리자 미리보기</div>
        {imgUrl && <img src={imgUrl} alt={snack.name} className="snack-photo" />}
        <h1 className="snack-title">{snack.name}</h1>
        {snack.brand && <p className="snack-brand">{snack.brand}</p>}
        <LikeButton snackId={snack.id} />
        <a href={`/snacks/${encodeURIComponent(snack.slug)}`} className="snack-ghost">
          공개 페이지로
        </a>
      </aside>

      <main className="snack-right">
        <section className="snack-card">
          <h2>평균 스탯</h2>
          <RadarWithUser
            snackId={snack.id}
            avg={avg || { tasty:0, value:0, plenty:0, clean:0, addictive:0 }}
          />
        </section>

        <section className="snack-card">
          <OneLiners snackId={snack.id} />
        </section>
      </main>

      <style jsx>{`
        .snack-wrap { max-width: 1100px; margin:0 auto; padding:16px; display:grid; grid-template-columns: 340px 1fr; gap:16px; }
        @media (max-width: 880px){ .snack-wrap { grid-template-columns: 1fr; } }
        .snack-left { display:grid; gap:12px; align-content:start; }
        .preview-badge { display:inline-block; padding:4px 8px; border-radius:6px; font-size:12px; color:#234; background:#eaf3ff; border:1px solid #cfe3ff; }
        .snack-photo { width:100%; height:auto; border-radius:10px; border:1px solid #eee; background:#fff; }
        .snack-title { margin:0; font-size:24px; }
        .snack-brand { color:#555; margin:0 0 4px; }
        .snack-ghost { display:inline-block; padding:8px 12px; border:1px solid #ddd; border-radius:8px; background:#f8f8f8; color:#222; text-decoration:none; }
        .snack-right { display:grid; gap:12px; }
        .snack-card { background:#fff; border:1px solid #eee; border-radius:12px; padding:16px; }
        .snack-card h2 { margin:0 0 10px; font-size:18px; }
      `}</style>
    </section>
  );
}
