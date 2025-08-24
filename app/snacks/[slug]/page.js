// app/snacks/[slug]/page.jsx
export const dynamic = "force-dynamic"; // 미리보기 즉시 반영용

import RadarChart from "@/components/RadarChart";
import RadarWithUser from "@/components/RadarWithUser";
import LikeButton from "@/components/LikeButton";
import OneLiners from "@/components/OneLiners";
import ReviewControls from "@/components/ReviewControls";
import AdminPreview from "@/components/AdminPreview";
import { createClient } from "@supabase/supabase-js";
import { permanentRedirect } from "next/navigation";
import { STAT_SLASH } from "@/lib/statLabels";

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
}

async function getBySlugOrId(slugOrId) {
  const sb = supabaseAnon();

  // URL 파라미터 디코딩 + 가벼운 정규화
  const key = decodeURIComponent(slugOrId || "");
  const normalized = key
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-+|-+$)/g, "");

  // 1) 슬러그 정확 매칭
  let { data: snack, error } = await sb
    .from("snacks")
    .select("id, name, brand, image_path, slug")
    .eq("slug", key)
    .eq("is_public", true)
    .maybeSingle();
  if (error) console.error("[snacks by slug] error:", error);

  // 2) 정확 매칭 없으면 정규화 값으로 한 번 더
  if (!snack && normalized !== key) {
    const { data: alt, error: e2 } = await sb
      .from("snacks")
      .select("id, name, brand, image_path, slug")
      .eq("slug", normalized)
      .eq("is_public", true)
      .maybeSingle();
    if (e2) console.error("[snacks by normalized slug] error:", e2);
    if (alt) snack = alt;
  }

  // 3) UUID로 접근한 경우 정규 슬러그로 리다이렉트
  if (!snack && /^[0-9a-f-]{36}$/i.test(key)) {
    const { data: byId } = await sb
      .from("snacks")
      .select("id, name, brand, image_path, slug")
      .eq("id", key)
      .eq("is_public", true)
      .maybeSingle();
    if (byId?.slug) permanentRedirect(`/snacks/${encodeURIComponent(byId.slug)}`);
  }

  if (!snack) return { snack: null, avg: null };

  // 평균 스탯(SSR)
  const { data: rows } = await sb
    .from("snack_scores")
    .select("tasty, value, plenty, clean, addictive")
    .eq("snack_id", snack.id);

  let avg = null;
  if (rows?.length) {
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
    avg = {
      tasty: s.tasty / n,
      value: s.value / n,
      plenty: s.plenty / n,
      clean: s.clean / n,
      addictive: s.addictive / n,
      count: n,
    };
  }

  return { snack, avg };
}

export async function generateMetadata({ params }) {
  const { slug } = await params;               //  async 프록시에서 안전 추출
  const { snack, avg } = await getBySlugOrId(slug);
  if (!snack) return { title: "SnackDB" };

  const title = `${snack.brand ? snack.brand + " " : ""}${snack.name} | SnackDB`;
  const desc = `${snack.brand || ""} ${snack.name}의 ${STAT_SLASH} 평가와 한줄평.`;
  const img = snack.image_path
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/images/snack?path=${encodeURIComponent(
        snack.image_path
      )}`
    : undefined;
  const canonical = `${process.env.NEXT_PUBLIC_SITE_URL}/snacks/${encodeURIComponent(
    snack.slug
  )}`;

  return {
    title,
    description: desc,
    alternates: { canonical },
    openGraph: { title, description: desc, images: img ? [img] : [] },
    twitter: { card: "summary_large_image", title, description: desc, images: img ? [img] : [] },
  };
}

export default async function Page({ params, searchParams }) {
  const { slug } = await params;
  const sp = (await searchParams) || {};
  const pv = sp.preview;
  const preview = pv != null && pv !== "0" && pv !== "false";
  if (preview) {
    // 클라이언트에서 관리자 확인 후 is_public 무시하고 렌더
    return <AdminPreview slug={slug} />;
  }
  const { snack, avg } = await getBySlugOrId(slug); // 기존 SSR (is_public=true)
  
  if (!snack) {
    return (
      <section style={{ padding: 16 }}>
        <h1>항목을 찾을 수 없습니다.</h1>
      </section>
    );
  }

  const imgUrl = snack.image_path
    ? `/api/images/snack?path=${encodeURIComponent(snack.image_path)}`
    : null;
  const { q = "" } = await searchParams;

  // JSON-LD (Product + AggregateRating)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: snack.name,
    brand: snack.brand || undefined,
    image: imgUrl || undefined,
    ...(avg
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: (
              (avg.tasty + avg.value + avg.plenty + avg.clean + avg.addictive) /
              5
            ).toFixed(1),
            reviewCount: avg.count,
          },
        }
      : {}),
  };

  return (
    <section className="snack-wrap">
      <aside className="snack-left">
        {imgUrl && <img src={imgUrl} alt={snack.name} className="snack-photo" />}
        <h1 className="snack-title">{snack.name}</h1>
        {snack.brand && <p className="snack-brand">{snack.brand}</p>}
        <LikeButton snackId={snack.id} />
        {q ? (
          <a href="javascript:history.back()" className="snack-ghost">
            ← 검색으로
          </a>
        ) : (
          <a href="/search" className="snack-ghost">
            목록
          </a>
        )}
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

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* 전역 <style> (서버 컴포넌트에서 styled-jsx 사용 금지) */}
      <style>{`
        .snack-wrap { max-width: 1100px; margin:0 auto; padding:16px; display:grid; grid-template-columns: 340px 1fr; gap:16px; }
        @media (max-width: 880px){ .snack-wrap { grid-template-columns: 1fr; } }
        .snack-left { display:grid; gap:12px; align-content:start; }
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
