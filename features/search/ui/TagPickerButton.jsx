// features/search/ui/TagPickerButton.jsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "@shared/api/supabaseClient";

// 실제 훅 경로
import { useSnackFlavors } from "@features/manage-snack-categories/model/useSnackFlavors";
import { useSnackTypes } from "@features/manage-snack-categories/model/useSnackTypes";

export default function TagPickerButton({ anchorRef, opRef, onInsert }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("flavors"); // flavors | types | keywords
  const [filter, setFilter] = useState("");

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

  // 바깥 클릭/ESC 닫기 (캡처 단계 + composedPath로 오판 방지)
  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e) => {
      const root = rootRef.current;
      if (!root) return;
      const path = typeof e.composedPath === "function" ? e.composedPath() : [];
      const inside = path.includes(root) || root.contains(e.target);
      if (!inside) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // 입력창의 현재 토큰들과 동기화 (칩 하이라이트)
  const [currentTokens, setCurrentTokens] = useState([]);
  useEffect(() => {
    const el = anchorRef?.current;
    if (!el) return;
    const update = () => {
      const arr = el.value.trim() ? el.value.trim().split(/\s+/) : [];
      setCurrentTokens(arr);
      el.closest(".navSearchBox")?.classList.toggle("hasChips", arr.length > 0);
    };
    update();
    el.addEventListener("input", update);
    return () => el.removeEventListener("input", update);
  }, [anchorRef]);
  const selectedSet = useMemo(() => new Set(currentTokens), [currentTokens]);

  /* ── 카탈로그 통합 ─────────────────────────────────────────── */

  // 맛/종류/키워드를 하나의 카탈로그로 통합(이름→id 매핑 생성)
  const catalogAll = useMemo(() => {
    const arr = [];
    (flavors || []).forEach(x => arr.push({ name: x.name, id: x.id }));
    (types || []).forEach(x => arr.push({ name: x.name, id: x.id }));
    (keywords || []).forEach(x => arr.push({ name: x.name, id: x.id }));
    return arr;
  }, [flavors, types, keywords]);

  const catalogNameSet = useMemo(
    () => new Set(catalogAll.map(x => x.name)),
    [catalogAll]
  );

  const catalogNameToId = useMemo(() => {
    const m = new Map();
    for (const x of catalogAll) if (!m.has(x.name)) m.set(x.name, x.id);
    return m;
  }, [catalogAll]);

  // 전역 선택 칩(탭과 무관)
  const selectedGlobalList = useMemo(
    () =>
      currentTokens
        .filter(t => catalogNameSet.has(t))
        .map(name => ({ name, id: catalogNameToId.get(name) ?? name })),
    [currentTokens, catalogNameSet, catalogNameToId]
  );

  /* ── 탭 목록 & 필터 ─────────────────────────────────────────── */

  const norm = (s) => (s || "").toLowerCase().trim();
  const q = norm(filter);

  const baseList = useMemo(() => {
    const src =
      tab === "flavors" ? (flavors || [])
      : tab === "types" ? (types || [])
      : (keywords || []);
    if (!q) return src;
    return src.filter(x => norm(x.name).includes(q));
  }, [tab, flavors, types, keywords, q]);

  // 탭 내에서 선택된 항목/나머지 분리 (아래 리스트 렌더링용)
  const [selectedList, restList] = useMemo(() => {
    const sel = [];
    const rest = [];
    for (const x of baseList) {
      (selectedSet.has(x.name) ? sel : rest).push(x);
    }
    return [sel, rest];
  }, [baseList, selectedSet]);

  /* ── 액션들 ───────────────────────────────────────────────── */

  // 토큰 토글(없으면 추가, 있으면 제거)
  const toggleToken = (name) => {
    const tok = (name || "").trim();
    if (!tok) return;

    if (typeof onInsert === "function") {
      onInsert(tok); // 필요 시 상위에서 처리
      return;
    }

    const el = anchorRef?.current;
    if (!el) return;

    let tokens = el.value.trim() ? el.value.trim().split(/\s+/) : [];
    if (tokens.includes(tok)) {
      tokens = tokens.filter(t => t !== tok); // 제거
    } else {
      tokens.push(tok); // 추가
    }
    el.value = tokens.join(" ");
    el.dispatchEvent(new Event("input", { bubbles: true })); // controlled 대응
    // 팝업은 열어둠(연속 선택)
  };

  // 선택 칩 모두 지우기(카탈로그에 있는 칩만 제거, 자유 텍스트 보존)
  const clearSelectedChips = () => {
    const el = anchorRef?.current;
    if (!el) return;
    let tokens = el.value.trim() ? el.value.trim().split(/\s+/) : [];
    const selectedChipSet = new Set(tokens.filter(t => catalogNameSet.has(t)));
    if (selectedChipSet.size === 0) return;
    tokens = tokens.filter(t => !selectedChipSet.has(t));
    el.value = tokens.join(" ");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  // AND/OR 모드
  const [op, setOp] = useState("and");
  useEffect(() => {
    const fromHidden = opRef?.current?.value;
    const fromURL = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("op")
        : null;
    const v = (fromHidden || fromURL || "and").toLowerCase();
    setOp(v === "or" ? "or" : "and");
    }, []);
  useEffect(() => {
    if (opRef?.current) opRef.current.value = op;
  }, [op, opRef]);

  /* ── UI ───────────────────────────────────────────────────── */

  return (
    <div className="tagpick" ref={rootRef}>
      <button
        type="button"
        className="tp-btn"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        title="태그 추가"
      >
        <span aria-hidden>🏷️</span>
      </button>

      {open && (
        <div className="tp-pop" role="dialog" aria-label="태그 선택">
          {/* 헤더: 좌측 상태/액션, 우측 닫기 */}
          <div className="tp-actions">
            <div className="tp-actions-left">
              <span className="tp-count">선택 {selectedGlobalList.length}</span>
              {/* 👇 AND / OR 토글 */}
              <div className="tp-op" role="group" aria-label="검색 결합 방식">
                <button
                  type="button"
                  className={`tp-op-btn ${op==="and"?"on":""}`}
                  aria-pressed={op==="and"}
                  onClick={()=>setOp("and")}
                  title="그리고(AND)"
                >그리고</button>
                <button
                  type="button"
                  className={`tp-op-btn ${op==="or"?"on":""}`}
                  aria-pressed={op==="or"}
                  onClick={()=>setOp("or")}
                  title="또는(OR)"
                >또는</button>
              </div>
              <button
                type="button"
                className="tp-clear"
                disabled={!selectedGlobalList.length}
                onClick={clearSelectedChips}
              >
                모두 지우기
              </button>
            </div>
            <div className="tp-actions-right">
              <button
                type="button"
                className="tp-close"
                onClick={() => setOpen(false)}
                aria-label="닫기"
              >
                ×
              </button>
            </div>
          </div>

          {/* 전역 선택 칩: 탭과 무관하게 항상 상단 고정 */}
          {!!selectedGlobalList.length && (
            <div className="tp-selected">
              {selectedGlobalList.map(x => (
                <button
                  type="button"
                  key={`sel-${x.id}`}
                  className="tp-chip on"
                  aria-pressed="true"
                  onClick={() => toggleToken(x.name)} // 다시 눌러 제거
                >
                  {x.name}
                </button>
              ))}
            </div>
          )}

          {/* 탭 스위처 */}
          <div className="tp-tabs">
            <button type="button" className={tab === "flavors" ? "on" : ""} onClick={() => setTab("flavors")}>맛</button>
            <button type="button" className={tab === "types" ? "on" : ""} onClick={() => setTab("types")}>종류</button>
            <button type="button" className={tab === "keywords" ? "on" : ""} onClick={() => setTab("keywords")}>키워드</button>
          </div>

          {/* 필터 입력 */}
          <div className="tp-filter">
            <input
              placeholder="필터 검색"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>

          {/* 탭 리스트(선택된 건 위로 고정되었으므로 여기엔 나머지 위주) */}
          <div className="tp-list">
            {restList.map((x) => {
              const on = selectedSet.has(x.name);
              return (
                <button
                  type="button"
                  key={x.id}
                  className={`tp-chip${on ? " on" : ""}`}
                  aria-pressed={on}
                  onClick={() => toggleToken(x.name)}
                >
                  {x.name}
                </button>
              );
            })}
            {!restList.length && !selectedList.length && (
              <div className="tp-empty">결과 없음</div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .tagpick { position: relative; display:flex; height:100%; align-self:stretch; }

        .tp-btn{
          width: var(--nav-search-size);
          height: 100%; /* 검색 박스 높이에 맞춤 */
          padding: 0;
          display:flex; align-items:center; justify-content:center;
          background: var(--nav-search-color);
          color:#fff;
          border:0; border-left:1px solid #0000;
          cursor:pointer;
          font-size: 18px;
          line-height: 1;
        }

        .tp-pop{
          position:absolute; top: calc(100% + 6px); right: 0; z-index: 30;
          width: min(380px, 90vw); max-height: 60vh; overflow:auto;
          background:#fff; border:1px solid #e6e6e6; border-radius:12px;
          box-shadow: 0 10px 24px rgba(0,0,0,.08); padding:10px; 
        }

        /* 헤더: 좌/우 분리 */
        .tp-actions{
          position: sticky; top: 0; z-index: 1;
          display: flex; justify-content: space-between; align-items: center;
          gap: 8px; background: #fff; padding: 6px 4px 4px;
        }
        .tp-actions-left{ display:flex; align-items:center; gap:8px; }
        .tp-actions-right{ display:flex; align-items:center; }
        .tp-count{ font-size:12px; color:#666; }
        .tp-clear{
          border:1px solid #ddd; background:#fafafa; border-radius:8px;
          font-size:12px; padding:4px 8px; cursor:pointer;
        }
        .tp-clear:disabled{ opacity:.5; cursor:not-allowed; }
        .tp-close{
          width:24px; height:24px; line-height:24px;
          border:0; background:transparent; cursor:pointer; font-size:18px;
        }

        /* 전역 선택 칩: 탭/필터보다 위 */
        .tp-selected{
          position: sticky; top: 32px; /* actions 높이에 맞춰 필요 시 보정 */
          z-index: 1;
          background:#fff;
          padding:4px 0 8px; margin-bottom: 6px;
          display:flex; flex-wrap:wrap; gap:6px;
          border-bottom:1px dashed #eee;
        }

        .tp-tabs{ display:flex; gap:6px; margin-bottom:8px; }
        .tp-tabs button{
          padding:6px 10px; border:1px solid #ddd; background:#fafafa; border-radius:999px; font-size:12px;
        }
        .tp-tabs button.on{ background:#eaf3ff; border-color:#d6e8ff; }

        .tp-filter input{
          width:100%; padding:8px 10px; border:1px solid #ddd; border-radius:8px; font-size:13px;
          margin-bottom:8px;
        }

        .tp-list{ display:flex; flex-wrap:wrap; gap:6px; }

        .tp-pop .tp-chip{
          width: auto !important; height: auto !important;
          background:#fff !important; color: inherit !important;
          border:1px solid #ddd !important; padding:6px 10px !important;
          border-radius:999px; cursor:pointer; font-size:12px;
        }
        .tp-pop .tp-chip.on{
          background:#000 !important; color:#fff !important; border-color:#000 !important;
        }

        .tp-empty{ color:#777; font-size:13px; padding:8px; }
        .tp-op{ display:inline-flex; gap:4px; margin-left:8px; }
        .tp-op-btn{
          border:1px solid #ddd; background:#fafafa; border-radius:999px;
          font-size:12px; padding:4px 10px; cursor:pointer;
        }
        .tp-op-btn.on{ background:#000; color:#fff; border-color:#000; }
      `}</style>
    </div>
  );
}
