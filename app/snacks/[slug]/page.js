// app/snacks/[slug]/page.jsx
export const dynamic = "force-dynamic";
export const revalidate = 0; // 안전하게 완전 SSR
import RadarWithUser from "@features/rate-snack/ui/RadarWithUser";
import LikeButton from "@features/like-snack/ui/LikeButton";
import OneLiners from "@entities/review/ui/OneLiners";
import AdminPreview from "@widgets/snack-preview/ui/AdminPreview";
import { getBySlugOrId } from "@entities/snack/model/getBySlugOrId";
import { snackMetadata, snackJsonLd } from "@shared/lib/seo/snackSeo";
import { redirect, notFound } from "next/navigation";
import { getSupabaseServer } from "@shared/api/supabase/server";

export async function generateMetadata({ params }) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(String(raw)).normalize("NFC").toLowerCase();
  const { snack, avg } = await getBySlugOrId(slug);
  if (snack) return snackMetadata(snack, avg);

  // 히스토리에서 현재 slug 찾아 메타 생성
  const sb = getSupabaseServer();
  const { data: hist } = await sb
    .from("snack_slug_history").select("snack_id").eq("old_slug", slug).single();
  if (hist?.snack_id) {
    const { data: cur } = await sb
      .from("snacks").select("slug").eq("id", hist.snack_id).single();
    if (cur?.slug) {
      const { snack: s2, avg: a2 } = await getBySlugOrId(cur.slug);
      if (s2) return snackMetadata(s2, a2);
    }
  }
  return { title: "SnackDB" };
}

export default async function Page({ params, searchParams }) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(String(raw)).normalize("NFC").toLowerCase();
  const sp = (await searchParams) || {};
  const preview = sp.preview != null && sp.preview !== "0" && sp.preview !== "false";

  if (preview) {
    return <AdminPreview slug={slug} />;
  }

  const { snack, avg, flavors, keywords } = await getBySlugOrId(slug);
  if (!snack) {
    const sb = getSupabaseServer();
    const { data: hist, error: histErr } = await sb
      .from("snack_slug_history")
      .select("snack_id")
      .eq("old_slug", slug)
      .single();
    if (!hist) {
   return (
     <pre style={{padding:16, background:"#111", color:"#0f0"}}>
       {JSON.stringify({ step:"hist-miss", slug, histErr }, null, 2)}
     </pre>
   );
 }
    
    if (hist?.snack_id) {
      const { data: cur, error: curErr } = await sb
        .from("snacks")
        .select("slug")
        .eq("id", hist.snack_id)
        .single();
      console.error("[current-slug]", { cur, curErr }); // 🔎 임시 로그
      if (cur?.slug) redirect(encodeURI(`/snacks/${cur.slug}`));
    }
    return notFound();
  }

  const imgUrl = snack.image_path
    ? `/api/images/snack?path=${encodeURIComponent(snack.image_path)}`
    : null;
  const { q = "" } = await searchParams;
  const jsonLd = snackJsonLd(snack, avg);

  return (
    <section className="snack-wrap">
      <aside className="snack-left">
        {imgUrl && <img src={imgUrl} alt={snack.name} className="snack-photo" />}
        <div className="title-row">
          <div className="title-left">
            <h1 className="snack-title">{snack.name}</h1>
          </div>
          <div className="title-right">
            <LikeButton snackId={snack.id} />
          </div>
        </div>
        {snack.brand && <p className="snack-brand">{snack.brand}</p>}
        {snack.type?.name && (
          <p className="snack-type">종류: {snack.type.name}</p>
        )}
        {!!(flavors && flavors.length) && (
          <div className="snack-flavors">
            {flavors.map(f => (
              <span key={f.id} className="flavor-chip">{f.name}</span>
            ))}
          </div>
        )}
        {!!(keywords && keywords.length) && (
          <div className="snack-keywords">
            {keywords.map(k => (
              <span key={k.id} className="keyword-chip">{k.name}</span>
            ))}
          </div>
        )}
        {q ? (
          <a href="javascript:history.back()" className="snack-ghost">
            ← 검색으로
          </a>
        ) : (
          <a href="/search" className="snack-ghost">목록</a>
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

      <style>{`
        .snack-wrap { max-width: 1100px; margin:0 auto; padding:16px; display:grid; grid-template-columns: 340px 1fr; gap:16px; }
        @media (max-width: 880px){ .snack-wrap { grid-template-columns: 1fr; } }
        .snack-left { display:grid; gap:12px; align-content:start; }
        .snack-photo { width:100%; height:auto; border-radius:10px; border:1px solid #eee; background:#fff; }
        .snack-title { margin:0; font-size:24px; }
        .snack-brand { color:#555; margin:0 0 4px; }
        .snack-type { color:#444; font-size:13px; margin:2px 0 6px; }
        .snack-flavors { display:flex; flex-wrap:wrap; gap:6px; margin:2px 0 6px; }
        .flavor-chip { display:inline-block; padding:4px 8px; border:1px solid #ddd; border-radius:999px; font-size:12px; background:#fafafa; }
        .snack-ghost { display:inline-block; padding:8px 12px; border:1px solid #ddd; border-radius:8px; background:#f8f8f8; color:#222; text-decoration:none; }
        .snack-right { display:grid; gap:12px; }
        .snack-card { background:#fff; border:1px solid #eee; border-radius:12px; padding:16px; }
        .snack-card h2 { margin:0 0 10px; font-size:18px; }
        .title-row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .title-left { display:flex; align-items:baseline; gap:8px; flex:1 1 auto; min-width:0; }
        .title-right { flex:0 0 auto; display:inline-flex; align-items:center; }
        .snack-keywords { display:flex; flex-wrap:wrap; gap:6px; margin:2px 0 6px; }
        .keyword-chip { display:inline-block; padding:4px 8px; border:1px solid #ddd; border-radius:999px; font-size:12px; background:#eef2ff; }
      `}</style>
    </section>
  );
}
