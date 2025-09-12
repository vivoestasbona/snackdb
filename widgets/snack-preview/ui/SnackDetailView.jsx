// widgets/snack-preview/ui/SnackDetailView.jsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import LikeButton from "@features/like-snack/ui/LikeButton";
import RadarWithUser from "@features/rate-snack/ui/RadarWithUser";
import OneLiners from "@entities/review/ui/OneLiners";
import InfoRequestButton from "@features/snack-info-request/ui/InfoRequestButton";

function useOutsideClose(ref, onClose) {
  useEffect(() => {
    function onDown(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) onClose?.();
    }
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [ref, onClose]);
}

function PopChip({ label, intent, className }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const router = useRouter();
  useOutsideClose(boxRef, () => setOpen(false));

  const line =
    intent === "type"
      ? `‘${label}’ 과자 모두 보기`
      : intent === "flavor"
      ? `‘${label}’ 맛의 과자 모두 보기`
      : intent === "keyword"
      ? `‘${label}’ 키워드의 과자 모두 보기`
      : intent === "brand"
      ? `‘${label}’ 의 과자 모두 보기`
      : `‘${label}’ 과자 모두 보기`;

  function go() {
    router.push(`/search?q=${encodeURIComponent(label)}&op=and&page=1`);
    setOpen(false);
  }

  return (
    <span className="chip-wrap">
      {/* ❗️여기 span에 기존 칩 클래스 그대로 전달 → UI 유지 */}
      <span
        className={className}
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v)=>!v); } }}
      >
        {label}
      </span>

      {open && (
        <span className="chip-pop" ref={boxRef} role="dialog" aria-label="태그 팝업">
          <button className="chip-pop-btn" onClick={go}>{line}</button>
        </span>
      )}

      <style jsx>{`
        .chip-wrap { position: relative; display: inline-block; }
        .chip-pop {
          position: absolute; top: 100%; left: 0; margin-top: 6px;
          background: #fff; border: 1px solid #e6e6e6; border-radius: 10px;
          box-shadow: 0 10px 24px rgba(0,0,0,.08); padding: 8px; z-index: 40;
          min-width: 210px;
        }
        .chip-pop-btn {
          width: 100%; text-align: left; cursor: pointer;
          background: #fff; border: 1px solid #dfe6ff; border-radius: 8px;
          padding: 8px 10px; font-size: 13px; line-height: 1.2;
        }
        .chip-pop-btn:hover { background: #f6f9ff; }
        @media (max-width: 640px) {
          .chip-pop { left: 50%; transform: translateX(-50%); min-width: 240px; }
        }
      `}</style>
    </span>
  );
}

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
            <a href={`/snacks/${encodeURIComponent(snack.slug)}`} className="ghost-link">
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

        {snack.brand && (
          <PopChip label={snack.brand} intent="brand" className="brand-text" />
        )}

        {/* ▼ 칩들 */}
        <div className="snack-tags">
          {snack.type?.name && (
            <PopChip label={snack.type.name} intent="type" className="type-tile" />
          )}
          {flavors.map((f) => (
            <PopChip key={f.id} label={f.name} intent="flavor" className="flavor-chip" />
          ))}
          {keywords.map((k) => (
            <PopChip key={k.id} label={k.name} intent="keyword" className="keyword-chip" />
          ))}
        </div>

        <div style={{marginTop: 12}}>
          <InfoRequestButton
            snackId={snack.id}
            initialTypeId={snack.type?.id || ""}
            initialFlavorIds={flavors.map(f=>f.id)}
            initialKeywords={keywords.map(k=>k.name)}
          />
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

        .snack-tags { 
          display:flex; flex-wrap:wrap; gap:6px; margin:4px 0; 
        }

        :global(.type-tile), :global(.flavor-chip), :global(.keyword-chip) {
          display:inline-block;
          padding:4px 10px;
          border-radius:999px;
          border:1px solid #ddd;
          background:#fafafa;
          font-size:12px;
          white-space:nowrap;
          line-height:1;
          cursor:pointer;         
          user-select:none;
        }

        :global(.flavor-chip) {          
          background:#fff0f6;
          border-color:#ffd6e7;
        }
        :global(.keyword-chip) {        
          background:#f0f7ff;
          border-color:#d6e4ff;
        }

        .snack-right { display:grid; gap:12px; }
        .snack-card { background:#fff; border:1px solid #eee; border-radius:10px; padding:12px; }
        .snack-card--chart { min-height: 320px; }

        :global(.brand-text) {
          color: #555;
          font-size: 14px;
          cursor: pointer;
          display: inline-block;
        }
        :global(.brand-text:hover) {
          text-decoration: none;
          color: #333;
        }
        
      `}</style>
    </section>
  );
}
