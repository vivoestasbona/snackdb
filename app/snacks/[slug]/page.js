// app/snacks/[slug]/page.jsx
export const revalidate = 120;
import RadarWithUser from "@features/rate-snack/ui/RadarWithUser";
import LikeButton from "@features/like-snack/ui/LikeButton";
import OneLiners from "@entities/review/ui/OneLiners";
import AdminPreview from "@widgets/snack-preview/ui/AdminPreview";
import { getBySlugOrId } from "@entities/snack/model/getBySlugOrId";
import { snackMetadata, snackJsonLd } from "@shared/lib/seo/snackSeo";

export async function generateMetadata({ params }) {
  const { slug } = await params;               //  async 프록시에서 안전 추출
  const { snack, avg } = await getBySlugOrId(slug);
  if (!snack) return { title: "SnackDB" };
  return snackMetadata(snack, avg);
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
        .title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .title-left {
          display: flex;
          align-items: baseline;
          gap: 8px;
          flex: 1 1 auto;
          min-width: 0;
        }

        .snack-title {
          margin: 0;
          font-size: 24px;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .snack-brand {
          margin: 4px 0 8px;
          color: #555;
          font-size: 14px;
        }

        .title-right {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
        }

      `}</style>
    </section>
  );
}
