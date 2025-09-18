"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "@shared/api/supabaseClient";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { useSnackFlavors } from "@features/manage-snack-categories/model/useSnackFlavors";
import { useSnackTypes } from "@features/manage-snack-categories/model/useSnackTypes";
import { useAvailableFlavors } from "@features/manage-snack-categories/model/useAvailableFlavors";
import { useAvailableTypes } from "@features/manage-snack-categories/model/useAvailableTypes";

export default function TagPickerButton({ anchorRef, opRef, onInsert, currentTypeId }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("flavors"); // flavors | types | keywords
  const [filter, setFilter] = useState("");

  /* 추가 1: 모달 바깥 클릭(터치 포함) 시 닫기 */
  useEffect(() => {
    if (!open) return;

    const handleOutside = (e) => {
      const root = rootRef.current;
      const anchor = anchorRef?.current;
      const target = e.target;

      // 내부 클릭(모달/트리거 버튼) 은 무시
      if (root?.contains(target)) return;
      if (anchor && anchor.contains && anchor.contains(target)) return;

      setOpen(false);
    };

    // 캡처 단계에서 먼저 잡아주면 내부 컴포넌트가 stopPropagation 해도 동작
    document.addEventListener("mousedown", handleOutside, true);
    document.addEventListener("touchstart", handleOutside, true);

    return () => {
      document.removeEventListener("mousedown", handleOutside, true);
      document.removeEventListener("touchstart", handleOutside, true);
    };
  }, [open, anchorRef]);

  /* Esc 키로 닫기 */
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // AND/OR 모드 — TDZ 방지: 먼저 선언
  const [op, setOp] = useState("and");
  // URL 변화에 반응해서 op 동기화
  useEffect(() => {
    const fromURL = (searchParams?.get("op") || "").toLowerCase();
    if (fromURL === "and" || fromURL === "or") {
      setOp(fromURL);
      if (opRef?.current) opRef.current.value = fromURL;
      if (typeof window !== "undefined") localStorage.setItem("search_op", fromURL);
      return;
    }
    // URL에 없으면 마지막 선택값(localStorage) 복원
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("search_op");
      if (saved === "and" || saved === "or") {
        setOp(saved);
        if (opRef?.current) opRef.current.value = saved;
      } else {
        setOp("and");
        if (opRef?.current) opRef.current.value = "and";
      }
    }
  }, [searchParams, opRef]);

  // 마스터 로드
  const { flavors } = useSnackFlavors();
  const { types } = useSnackTypes();

  // 입력창 토큰 동기화
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

  // 종류 이름→id 매핑 / 유추 typeId
  const typeNameToId = useMemo(() => {
    const m = new Map();
    (types || []).forEach((t) => m.set(t.name, t.id));
    return m;
  }, [types]);
  const derivedTypeId = useMemo(() => {
    for (const tok of currentTokens) {
      const id = typeNameToId.get(tok);
      if (id) return id;
    }
    return null;
  }, [currentTokens, typeNameToId]);
  const effectiveTypeId = currentTypeId || derivedTypeId;

  // 선택된 "맛"만 추려 flavor_id 배열
  const flavorNameToId = useMemo(() => {
    const m = new Map();
    (flavors || []).forEach((f) => m.set(f.name, f.id));
    return m;
  }, [flavors]);
  const selectedFlavorIds = useMemo(() => {
    const arr = [];
    for (const tok of currentTokens) {
      const id = flavorNameToId.get(tok);
      if (id) arr.push(id);
    }
    return arr;
  }, [currentTokens, flavorNameToId]);

  // 집계 훅 호출
  const { countsMap: countsFlavors, loading: loadingFlavors } =
    useAvailableFlavors(effectiveTypeId, selectedFlavorIds, op);
  const { countsMap: countsTypes, loading: loadingTypes } =
    useAvailableTypes(selectedFlavorIds, op);

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
    return () => {
      alive = false;
    };
  }, []);

  // 선택된 "종류" id들 (종류 탭 비활성화 규칙용)
  const selectedTypeIds = useMemo(() => {
    const arr = [];
    for (const tok of currentTokens) {
      const id = typeNameToId.get(tok);
      if (id) arr.push(id);
    }
    return arr;
  }, [currentTokens, typeNameToId]);

  // 카탈로그 통합
  const catalogAll = useMemo(() => {
    const arr = [];
    (flavors || []).forEach((x) => arr.push({ name: x.name, id: x.id }));
    (types || []).forEach((x) => arr.push({ name: x.name, id: x.id }));
    (keywords || []).forEach((x) => arr.push({ name: x.name, id: x.id }));
    return arr;
  }, [flavors, types, keywords]);
  const catalogNameSet = useMemo(() => new Set(catalogAll.map((x) => x.name)), [catalogAll]);
  const catalogNameToId = useMemo(() => {
    const m = new Map();
    for (const x of catalogAll) if (!m.has(x.name)) m.set(x.name, x.id);
    return m;
  }, [catalogAll]);
  const selectedGlobalList = useMemo(
    () =>
      currentTokens
        .filter((t) => catalogNameSet.has(t))
        .map((name) => ({ name, id: catalogNameToId.get(name) ?? name })),
    [currentTokens, catalogNameSet, catalogNameToId]
  );

  // 탭/필터
  const norm = (s) => (s || "").toLowerCase().trim();
  const q = norm(filter);
  const baseList = useMemo(() => {
    const src = tab === "flavors" ? flavors || [] : tab === "types" ? types || [] : keywords || [];
    if (!q) return src;
    return src.filter((x) => norm(x.name).includes(q));
  }, [tab, flavors, types, keywords, q]);

  const [selectedList, restList] = useMemo(() => {
    const sel = [];
    const rest = [];
    for (const x of baseList) (selectedSet.has(x.name) ? sel : rest).push(x);
    return [sel, rest];
  }, [baseList, selectedSet]);

  // 토큰 토글
  const toggleToken = (name) => {
    const tok = (name || "").trim();
    if (!tok) return;

    if (typeof onInsert === "function") {
      onInsert(tok);
      return;
    }

    const el = anchorRef?.current;
    if (!el) return;

    let tokens = el.value.trim() ? el.value.trim().split(/\s+/) : [];
    if (tokens.includes(tok)) tokens = tokens.filter((t) => t !== tok);
    else tokens.push(tok);
    el.value = tokens.join(" ");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const clearSelectedChips = () => {
    const el = anchorRef?.current;
    if (!el) return;
    let tokens = el.value.trim() ? el.value.trim().split(/\s+/) : [];
    const selectedChipSet = new Set(tokens.filter((t) => catalogNameSet.has(t)));
    if (!selectedChipSet.size) return;
    tokens = tokens.filter((t) => !selectedChipSet.has(t));
    el.value = tokens.join(" ");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const setOpAndSync = (next) => {
    const val = next === "or" ? "or" : "and";
    setOp(val);
    if (opRef?.current) opRef.current.value = val;
    if (typeof window !== "undefined") localStorage.setItem("search_op", val);
    // 현재 쿼리 유지 + op만 갱신
    const params = new URLSearchParams(searchParams?.toString());
    params.set("op", val); // and/or 모두 명시적으로 보존
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="tagpick" ref={rootRef}>
      <button
        type="button"
        className="tp-btn"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="태그 추가"
      >
        <span aria-hidden>🏷️</span>
      </button>

      {open && (
        <div className="tp-pop" role="dialog" aria-label="태그 선택">
          {/* 헤더 */}
          <div className="tp-actions">
            <div className="tp-actions-left">
              <span className="tp-count">선택 {selectedGlobalList.length}</span>

              {/* AND / OR 토글 */}
              <div className="tp-op" role="group" aria-label="검색 결합 방식">
                <button
                  type="button"
                  className={`tp-op-btn ${op === "and" ? "on" : ""}`}
                  aria-pressed={op === "and"}
                  onClick={() => setOpAndSync("and")}
                >
                  그리고
                </button>
                <button
                  type="button"
                  className={`tp-op-btn ${op === "or" ? "on" : ""}`}
                  aria-pressed={op === "or"}
                  onClick={() => setOpAndSync("or")}
                >
                  또는
                </button>
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
              <button type="button" className="tp-close" onClick={() => setOpen(false)} aria-label="닫기">
                ×
              </button>
            </div>
          </div>

          {/* 전역 선택 칩 */}
          {!!selectedGlobalList.length && (
            <div className="tp-selected">
              {selectedGlobalList.map((x) => (
                <button
                  type="button"
                  key={`sel-${x.id}`}
                  className="tp-chip on"
                  aria-pressed="true"
                  onClick={() => toggleToken(x.name)}
                >
                  {x.name}
                </button>
              ))}
            </div>
          )}

          {/* 탭 */}
          <div className="tp-tabs">
            <button type="button" className={tab === "flavors" ? "on" : ""} onClick={() => setTab("flavors")}>
              맛
            </button>
            <button type="button" className={tab === "types" ? "on" : ""} onClick={() => setTab("types")}>
              종류
            </button>
            <button type="button" className={tab === "keywords" ? "on" : ""} onClick={() => setTab("keywords")}>
              키워드
            </button>
          </div>

          {/* 필터 */}
          <div className="tp-filter">
            <input placeholder="필터 검색" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>

          {/* 목록 */}
          <div className="tp-list">
            {restList.map((x) => {
              const on = selectedSet.has(x.name);
              let disabled = false;

              if (tab === "flavors") {
                // 로딩 중에는 비활성화하지 않음 → 깜빡임 방지
                disabled = op === "and" && !loadingFlavors ? (countsFlavors?.[x.id] || 0) === 0 : false;
              } else if (tab === "types") {
                if (op === "and") {
                  if (selectedTypeIds.length > 0) {
                    // 타입 하나라도 선택되어 있으면, 그 외 타입은 전부 비활성화 (type은 단일)
                    disabled = !selectedTypeIds.includes(x.id);
                  } else {
                    // 맛만 선택한 상태: 가능한 타입만 활성
                    disabled = !loadingTypes && (countsTypes?.[x.id] || 0) === 0;
                  }
                }
              }

              return (
                <button
                  type="button"
                  key={x.id}
                  className={`tp-chip${on ? " on" : ""}${disabled ? " disabled" : ""}`}
                  aria-pressed={on}
                  onClick={() => !disabled && toggleToken(x.name)}
                  disabled={disabled}
                >
                  {x.name}
                </button>
              );
            })}

            {!restList.length && !selectedList.length && <div className="tp-empty">결과 없음</div>}
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
        .tp-pop .tp-chip.disabled{
          opacity:.45; cursor:not-allowed; background:#f8f8f8 !important; color:#999 !important; border-color:#eee !important;
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
