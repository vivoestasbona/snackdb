// widgets/snack-preview/ui/SnackDetailView.jsx

"use client";

import LikeButton from "@features/like-snack/ui/LikeButton";
import RadarWithUser from "@features/rate-snack/ui/RadarWithUser";
import OneLiners from "@entities/review/ui/OneLiners";

export default function SnackDetailView({
  snack,
  avg,
  flavors = [],
  keywords = [],
  preview = false,
}) {
  const imgUrl = snack?.image_path
    ? `/api/images/snack?path=${encodeURIComponent(snack.image_path)}`
    : null;

  return (
    <section className="snack-wrap">
      <aside className="snack-left">
        {preview && (
          <div className="preview-row">
            <span className="preview-badge">관리자 미리보기</span>
            <a
              href={`/snacks/${encodeURIComponent(snack.slug)}`}
              className="ghost-link"
            >
              공개 페이지로
            </a>
          </div>
        )}

        {/* 이미지 */}
        {imgUrl ? (
          <div className="imgBox"><img src={imgUrl} alt={snack.name} /></div>
        ) : (
          <div className="imgBox placeholder" aria-hidden />
        )}

        {/* 제목 + 좋아요 */}
        <div className="title-row">
          <h1 className="snack-title">{snack.name}</h1>
          <div className="title-right"><LikeButton snackId={snack.id} /></div>
        </div>

        {/* 브랜드 */}
        {snack.brand && <p className="snack-brand">{snack.brand}</p>}

        {/* 태그 타일(카테고리·맛·키워드 한 줄) */}
        <div className="snack-tags">
          {snack.type?.name && <span className="type-tile">{snack.type.name}</span>}
          {flavors.map(f => <span key={f.id} className="flavor-chip">{f.name}</span>)}
          {keywords.map(k => <span key={k.id} className="keyword-chip">{k.name}</span>)}
        </div>
      </aside>

      {/* 우측: 차트 + 한줄평 */}
      <main className="snack-right">
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

      {/* ⬇️ 공개 상세 페이지의 스타일을 이관(동일 시각 보장) */}
      <style jsx>{`
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

        .preview-row { display:flex; gap:8px; align-items:center; }
        .preview-badge {
          display:inline-block; padding:4px 10px; border-radius:999px;
          font-size:12px; color:#234; background:#eaf3ff; border:1px solid #cfe6ff;
        }
        .ghost-link { font-size:12px; color:#347; text-decoration:underline; opacity:0.9; }

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
          background: repeating-linear-gradient(45deg, #f5f5f5 0 10px, #f0f0f0 10px 20px);
        }

        .title-row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .snack-title { margin: 0; font-size: 24px; }
        .title-right { flex:0 0 auto; display:inline-flex; align-items:center; min-width:64px; min-height:32px; }

        .snack-brand { color:#555; }

        .snack-tags {
          display: flex;
          flex-wrap: wrap;   /* 넘치면 줄바꿈 */
          gap: 6px;
          margin: 4px 0;
        }

        .type-tile, .flavor-chip, .keyword-chip {
          display: inline-block;
          padding: 4px 10px;
          border: 1px solid #ddd;
          border-radius: 999px;
          font-size: 12px;
          line-height: 1.2;
          background: #fafafa; /* 기본(카테고리) */
          white-space: nowrap;
        }
        .flavor-chip { background: #ffeef4; border-color:#ffd6e5; }   /* 연한 분홍 */
        .keyword-chip { background: #eef6ff; border-color:#d7e7ff; }  /* 연한 파랑 */

        .snack-right { display:grid; gap:12px; }
        .snack-card {
          background: #fff;
          border: 1px solid #eee;
          border-radius: 10px;
          padding: 12px;
          min-height: 160px;
        }
        .snack-card--chart { min-height: 320px; }

        .skl { width:100%; height: 120px; border-radius: 8px; background:linear-gradient(90deg,#f6f7f8,#edeef1,#f6f7f8); background-size:200% 100%; animation: shk 1.2s ease-in-out infinite; }
        .skl.skl-chart { height: 280px; }
        @keyframes shk { 0% {background-position: 0% 0} 100% {background-position: -200% 0} }
      `}</style>
    </section>
  );
}
