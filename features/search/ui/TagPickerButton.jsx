// features/search/ui/TagPickerButton.jsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "@shared/api/supabaseClient";
// ✅ 실제 경로
import { useSnackFlavors } from "@features/manage-snack-categories/model/useSnackFlavors";
import { useSnackTypes } from "@features/manage-snack-categories/model/useSnackTypes";

export default function TagPickerButton({ anchorRef, onInsert }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("flavors"); // flavors | types | keywords
  const [filter, setFilter] = useState("");
  const popRef = useRef(null);

  // 맛/종류
  const { flavors } = useSnackFlavors();
  const { types } = useSnackTypes();

  // 키워드(상위 사용량 순) 로드
  const [keywords, setKeywords] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = getSupabaseClient();
      const { data } = await sb
        .from("snack_keywords")
        .select("id,name,usage_count")
        .eq("is_active", true)
        .order("usage_count", { ascending: false })
        .order("name", { ascending: true })
        .limit(100);
      if (alive) setKeywords(data || []);
    })();
    return () => { alive = false; };
  }, []);

  // 외부 클릭/ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (rootRef.current?.contains(e.target)) return; // 컴포넌트 내부면 무시
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // 필터링
  const norm = (s)=> (s||"").toLowerCase().trim();
  const q = norm(filter);
  const list = useMemo(() => {
    const src = tab === "flavors" ? (flavors||[])
             : tab === "types"   ? (types||[])
             : (keywords||[]);
    if (!q) return src;
    return src.filter(x => norm(x.name).includes(q));
  }, [tab, flavors, types, keywords, q]);

  // 검색창에 토큰 추가
  const addToken = (name) => {
    const tok = (name || "").trim();
    if (!tok) return;
    if (typeof onInsert === "function") {
      onInsert(tok);
    } else if (anchorRef?.current) {
      const el = anchorRef.current;
      const cur = el.value || "";
      const tokens = cur.trim() ? cur.trim().split(/\s+/) : [];
      if (!tokens.includes(tok)) tokens.push(tok);
      el.value = tokens.join(" ");
      el.dispatchEvent(new Event("input", { bubbles: true })); // controlled 대응
      el.focus();
    }
  };

  return (
    <div className="tagpick" ref={rootRef}>
      <button type="button" className="tp-btn" aria-expanded={open} onClick={() => setOpen(v=>!v)} title="태그 추가">
        <span aria-hidden>🏷️</span>
      </button>

      {open && (
        <div className="tp-pop" ref={popRef} role="dialog" aria-label="태그 선택">
          <button type="button" className="tp-close" onClick={()=>setOpen(false)} aria-label="닫기">×</button>
          <div className="tp-tabs">
            <button type="button" className={tab==="flavors"?"on":""}   onClick={()=>setTab("flavors")}>맛</button>
            <button type="button" className={tab==="types"?"on":""}     onClick={()=>setTab("types")}>종류</button>
            <button type="button" className={tab==="keywords"?"on":""}  onClick={()=>setTab("keywords")}>키워드</button>
           </div>

          <div className="tp-filter">
            <input placeholder="필터 검색" value={filter} onChange={e=>setFilter(e.target.value)} />
          </div>

          <div className="tp-list">
            {list.map((x) => (
              <button type="button" key={x.id} className="tp-chip" onClick={()=>addToken(x.name)}>{x.name}</button>
            ))}
            {!list.length && <div className="tp-empty">결과 없음</div>}
          </div>
        </div>
      )}

      <style jsx>{`
        .tagpick { position: relative; display:flex; height:100%; align-self:stretch; }
        /* 토글 버튼을 검색 버튼과 동일 룩으로 */
        .tp-btn{
            width: var(--nav-search-size);
            height: var(--nav-search-size);
            height: 100%; 
            padding: 0;
            display:flex; align-items:center; justify-content:center;
            background: var(--nav-search-color);
            color:#fff;
            border:0; border-left:1px solid #0000;  /* 경계감 미세 조절 */
            cursor:pointer;
            font-size: 18px; /* 이모지 크기 */
            line-height: 1;
        }

        /* 팝업 안 칩 버튼들은 평범한 버튼으로 보이게 (중요: !important로 상쇄) */
        .tp-pop .tp-chip{
            width: auto !important;
            height: auto !important;
            background:#fff !important;
            color: inherit !important;
            border:1px solid #ddd !important;
            padding:6px 10px !important;
        }
        .tp-pop{
            position:absolute; top: calc(100% + 6px); right: 0; z-index: 30;
            width: min(360px, 90vw); max-height: 60vh; overflow:auto;
            background:#fff; border:1px solid #e6e6e6; border-radius:12px;
            box-shadow: 0 10px 24px rgba(0,0,0,.08); padding:10px;
        }
        .tp-close{
            position:absolute; top:6px; right:8px;
            width:24px; height:24px; line-height:24px;
            border:0; background:transparent; cursor:pointer; font-size:22px;
        }
        .tp-tabs{ display:flex; gap:6px; margin-bottom:8px; }
        .tp-tabs button{ padding:6px 10px; border:1px solid #ddd; background:#fafafa; border-radius:999px; font-size:12px; }
        .tp-tabs button.on{ background:#eaf3ff; border-color:#d6e8ff; }
        .tp-filter input{ width:100%; padding:8px 10px; border:1px solid #ddd; border-radius:8px; font-size:13px; margin-bottom:8px; }
        .tp-list{ display:flex; flex-wrap:wrap; gap:6px; }
        .tp-chip{ padding:6px 10px; border:1px solid #ddd; border-radius:999px; background:#fff; font-size:12px; cursor:pointer; }
        .tp-chip:hover{ background:#f3f3f3; }
        .tp-empty{ color:#777; font-size:13px; padding:8px; }
      `}</style>
    </div>
  );
}
