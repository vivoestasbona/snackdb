export const dynamic = "force-dynamic";
export const revalidate = 0;

import RadarWithUser from "@features/rate-snack/ui/RadarWithUser";
import LikeButton from "@features/like-snack/ui/LikeButton";
import OneLiners from "@entities/review/ui/OneLiners";
import AdminPreview from "@widgets/snack-preview/ui/AdminPreview";
import { getBySlugOrId } from "@entities/snack/model/getBySlugOrId";
import { snackMetadata, snackJsonLd } from "@shared/lib/seo/snackSeo";
import { redirect, notFound } from "next/navigation";

export async function generateMetadata({ params }) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(String(raw)).normalize("NFC").toLowerCase();
  const { snack, avg } = await getBySlugOrId(slug);
  if (snack) return snackMetadata(snack, avg);
  return { title: "SnackDB" };
}

export default async function Page({ params, searchParams }) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(String(raw)).normalize("NFC").toLowerCase();
  const sp = (await searchParams) || {};
  const preview = sp.preview != null && sp.preview !== "0" && sp.preview !== "false";

  if (preview) return <AdminPreview slug={slug} />;

  const { snack, avg, flavors, keywords } = await getBySlugOrId(slug);
  if (!snack) return notFound();

  const imgUrl = snack.image_path
    ? `/api/images/snack?path=${encodeURIComponent(snack.image_path)}`
    : null;

  return (
    <section className="snack-wrap">
      <aside className="snack-left">
        {/* ✅ aspect-ratio로 높이 예약 */}
        {imgUrl ? (
          <div className="imgBox"><img src={imgUrl} alt={snack.name} /></div>
        ) : (
          <div className="imgBox placeholder" aria-hidden />
        )}

        <div className="title-row">
          <h1 className="snack-title">{snack.name}</h1>
          {/* ✅ LikeButton 자리 폭 고정 */}
          <div className="title-right">
            <LikeButton snackId={snack.id} />
          </div>
        </div>

        {snack.brand && <p className="snack-brand">{snack.brand}</p>}
        {snack.type?.name && <p className="snack-type">종류: {snack.type.name}</p>}

        {!!flavors?.length && (
          <div className="snack-flavors">
            {flavors.map(f => <span key={f.id} className="flavor-chip">{f.name}</span>)}
          </div>
        )}
        {!!keywords?.length && (
          <div className="snack-keywords">
            {keywords.map(k => <span key={k.id} className="keyword-chip">{k.name}</span>)}
          </div>
        )}
      </aside>

      <main className="snack-right">
        {/* ✅ 카드별 최소 높이 + 단순 스켈레톤 */}
        <section className="snack-card snack-card--chart">
          <h2>평균 스탯</h2>
          {avg ? (
            <RadarWithUser snackId={snack.id} avg={avg}/>
          ) : (
            <div className="skl skl-chart" aria-hidden />
          )}
        </section>

        <section className="snack-card snack-card--reviews">
          <OneLiners snackId={snack.id} fallback={<div className="skl skl-reviews" />} />
        </section>
      </main>

      <style>{`
        .snack-wrap { max-width: 1100px; margin:0 auto; padding:16px; display:grid; grid-template-columns:340px 1fr; gap:16px; }
        @media (max-width:880px){ .snack-wrap{ grid-template-columns:1fr; } }

        .snack-left { display:grid; gap:12px; align-content:start; }

        .imgBox {
          width:100%; aspect-ratio:4/3; border-radius:10px; border:1px solid #eee;
          background:#f5f5f5; overflow:hidden;
        }
        .imgBox img { width:100%; height:100%; object-fit:cover; display:block; }
        .imgBox.placeholder { background:repeating-linear-gradient(45deg,#f5f5f5 0 10px,#f0f0f0 10px 20px); }

        .title-row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .snack-title { margin:0; font-size:24px; }
        .title-right { flex:0 0 auto; display:inline-flex; align-items:center; min-width:64px; min-height:32px; }

        .snack-brand { color:#555; }
        .snack-type { color:#444; font-size:13px; }

        .snack-flavors, .snack-keywords { display:flex; flex-wrap:wrap; gap:6px; }
        .flavor-chip, .keyword-chip {
          padding:4px 8px; border:1px solid #ddd; border-radius:999px; font-size:12px;
        }
        .keyword-chip { background:#eef2ff; }

        .snack-right { display:grid; gap:12px; }
        .snack-card {
          background:#fff; border:1px solid #eee; border-radius:12px; padding:16px;
          min-height:120px;
        }
        .snack-card--chart { min-height:260px; }

        .skl {
          width:100%; border-radius:10px;
          background:linear-gradient(90deg,#f0f0f0,#f7f7f7,#f0f0f0);
          background-size:200% 100%;
          animation:shine 1.2s ease-in-out infinite;
        }
        .skl-chart { height:220px; }
        .skl-reviews { height:100px; }
        @keyframes shine { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>
    </section>
  );
}
