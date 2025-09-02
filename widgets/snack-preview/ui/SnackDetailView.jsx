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

        <div className="imgBox">
          {imgUrl ? <img src={imgUrl} alt={snack.name} /> : <div className="placeholder" />}
        </div>

        <div className="title-row">
          <h1 className="snack-title">{snack.name}</h1>
          <div className="title-right"><LikeButton snackId={snack.id} /></div>
        </div>

        {snack.brand && <p className="snack-brand">{snack.brand}</p>}

        <div className="snack-tags">
          {snack.type?.name && <span className="type-tile">{snack.type.name}</span>}
          {flavors.map(f => <span key={f.id} className="flavor-chip">{f.name}</span>)}
          {keywords.map(k => <span key={k.id} className="keyword-chip">{k.name}</span>)}
        </div>
      </aside>

      <main className="snack-right">
        <section className="snack-card snack-card--chart">
          <h2>평균 스탯</h2>
          <RadarWithUser snackId={snack.id} avg={avg || undefined} />
        </section>

        <section className="snack-card snack-card--reviews">
          <OneLiners snackId={snack.id} />
        </section>
      </main>

      <style jsx>{`
        .snack-wrap {
          max-width: 1100px; margin: 0 auto; padding: 16px;
          display: grid; gap: 16px; grid-template-columns: 340px 1fr;
        }
        @media (max-width: 880px) { .snack-wrap { grid-template-columns: 1fr; } }

        .snack-left { display: grid; gap: 12px; align-content: start; }

        .preview-row { display:flex; gap:8px; align-items:center; }
        .preview-badge {
          display:inline-block; padding:4px 10px; border-radius:999px;
          font-size:12px; color:#234; background:#eaf3ff; border:1px solid #cfe6ff;
        }
        .ghost-link { font-size:12px; color:#347; text-decoration:underline; opacity:0.9; }

        .imgBox {
          width: 100%; aspect-ratio: 4/3; border-radius: 10px; border: 1px solid #eee;
          background: #f5f5f5; overflow: hidden;
        }
        .imgBox img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .placeholder {
          width:100%; height:100%; background: repeating-linear-gradient(45deg,#f5f5f5 0 10px,#f0f0f0 10px 20px);
        }

        .title-row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .snack-title { margin: 0; font-size: 24px; }
        .title-right { min-width:64px; min-height:32px; display:flex; align-items:center; }

        .snack-brand { color:#555; }

        .snack-tags { display:flex; flex-wrap:wrap; gap:6px; margin:4px 0; }
        .type-tile, .flavor-chip, .keyword-chip {
          display:inline-block; padding:4px 10px; border:1px solid #ddd; border-radius:999px;
          font-size:12px; background:#fafafa; white-space:nowrap;
        }
        .flavor-chip { background:#ffeef4; border-color:#ffd6e5; }
        .keyword-chip { background:#eef6ff; border-color:#d7e7ff; }

        .snack-right { display:grid; gap:12px; }
        .snack-card { background:#fff; border:1px solid #eee; border-radius:10px; padding:12px; }
        .snack-card--chart { min-height: 320px; }
      `}</style>
    </section>
  );
}
