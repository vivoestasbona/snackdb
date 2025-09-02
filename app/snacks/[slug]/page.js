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

        <div className="snack-tags">
          {snack.type?.name && <span className="type-tile">{snack.type.name}</span>}
          {flavors.map(f => <span key={f.id} className="flavor-chip">{f.name}</span>)}
          {keywords.map(k => <span key={k.id} className="keyword-chip">{k.name}</span>)}
        </div>

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
        .snack-wrap {
          max-width: 1100px;
          margin: 0 auto;
          padding: 16px;
          display: grid;
          grid-template-columns: 340px 1fr;
          gap: 16px;
        }
        @media (max-width: 880px) {
          .snack-wrap { grid-template-columns: 1fr; }
        }

        .snack-left { display: grid; gap: 12px; align-content: start; }

        .imgBox {
          width: 100%;
          aspect-ratio: 4/3;
          border-radius: 10px;
          border: 1px solid #eee;
          background: #f5f5f5;
          overflow: hidden;
        }
        .imgBox img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .imgBox.placeholder {
          background: repeating-linear-gradient(
            45deg, #f5f5f5 0 10px, #f0f0f0 10px 20px
          );
        }

        .title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .snack-title { margin: 0; font-size: 24px; }
        .title-right {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          min-width: 64px;
          min-height: 32px;
        }

        .snack-brand { color: #555; }

        /* ✅ 카테고리·맛·키워드 모두 하나의 행에 합치기 */
        .snack-tags {
          display: flex;
          flex-wrap: wrap;   /* 넘치면 줄바꿈 */
          gap: 6px;
          margin: 4px 0;
        }

        /* 공통 타일 모양 */
        .type-tile,
        .flavor-chip,
        .keyword-chip {
          display: inline-block;
          padding: 4px 10px;
          border: 1px solid #ddd;
          border-radius: 999px;
          font-size: 12px;
          line-height: 1.2;
          background: #fafafa; /* 기본(카테고리) */
          white-space: nowrap;
        }

        /* 색상 차별화 */
        .flavor-chip { background: #ffeef5; }  /* 연한 분홍 */
        .keyword-chip { background: #eef2ff; } /* 연한 파랑 */

        /* 옛날 '종류:' 문구 숨기기 */
        .snack-type { display: none !important; }

        /* 카드 및 스켈레톤 기존 스타일 유지 */
        .snack-right { display: grid; gap: 12px; }
        .snack-card {
          background: #fff;
          border: 1px solid #eee;
          border-radius: 12px;
          padding: 16px;
          min-height: 120px;
        }
        .snack-card--chart { min-height: 260px; }
        .skl {
          width: 100%; border-radius: 10px;
          background: linear-gradient(90deg,#f0f0f0,#f7f7f7,#f0f0f0);
          background-size: 200% 100%;
          animation: shine 1.2s ease-in-out infinite;
        }
        .skl-chart { height: 220px; }
        .skl-reviews { height: 100px; }
        @keyframes shine {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </section>
  );
}
