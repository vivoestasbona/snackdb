// features/search/ui/TagPickerButton.jsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "@shared/api/supabaseClient";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { useSnackFlavors } from "@features/manage-snack-categories/model/useSnackFlavors";
import { useSnackTypes } from "@features/manage-snack-categories/model/useSnackTypes";
import { useAvailableFlavors } from "@features/manage-snack-categories/model/useAvailableFlavors";
import { useAvailableTypes } from "@features/manage-snack-categories/model/useAvailableTypes";

function normalizeOp(v) { return v?.toLowerCase() === "or" ? "or" : "and"; }
const norm = (s) => (s || "").toLowerCase().trim();

export default function TagPickerButton({ anchorRef, opRef, onInsert, currentTypeId }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("flavors");  // flavors | types | keywords
  const [filter, setFilter] = useState("");

  // ===== AND/OR: state 단일 소스 =====
  const [op, setOp] = useState(() => {
    const refVal = opRef?.current?.value?.toLowerCase?.();
    if (refVal === "and" || refVal === "or") return refVal;
    if (typeof window !== "undefined") {
      const fromURL = new URLSearchParams(window.location.search).get("op")?.toLowerCase();
      if (fromURL === "and" || fromURL === "or") return fromURL;
      const saved = localStorage.getItem("search_op");
      if (saved === "and" || saved === "or") return saved;
    }
    return "and";
  });

  // URL/저장소 → state 동기화
  useEffect(() => {
    const fromURL = (searchParams?.get("op") || "").toLowerCase();
    let next =
      fromURL === "and" || fromURL === "or"
        ? fromURL
        : (typeof window !== "undefined" ? (localStorage.getItem("search_op") || "").toLowerCase() : "");
    if (next !== "and" && next !== "or") next = "and";
    if (next !== op) {
      setOp(next);
      if (opRef?.current) opRef.current.value = next;
    }
    if (typeof window !== "undefined") localStorage.setItem("search_op", next);
  }, [searchParams, opRef, op]);

  // /search 진입 시 op 없으면 주입
  useEffect(() => {
    if (!pathname?.startsWith?.("/search")) return;
    if (!searchParams?.get("op")) {
      const raw = typeof window !== "undefined" ? window.location.search : (searchParams?.toString() || "");
      const params = new URLSearchParams(raw);
      const refVal = (opRef?.current?.value || "").toLowerCase();
      const chosen = (refVal === "or" || refVal === "and") ? refVal : normalizeOp(op);
      params.set("op", chosen);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [pathname, searchParams, op, router]);

  // 외부 클릭/ESC로 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      const root = rootRef.current, anchor = anchorRef?.current, t = e.target;
      if (root?.contains(t)) return;
      if (anchor && anchor.contains && anchor.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("touchstart", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("touchstart", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, anchorRef]);

  // 현재 q 토큰 추적(오프스크린 input 값 기준)
  const [currentTokens, setCurrentTokens] = useState([]);
  useEffect(() => {
    const el = anchorRef?.current; if (!el) return;
    const update = () => {
      const arr = el.value !== undefined && el.value !== null
        ? (String(el.value).length ? String(el.value).split(/\s+/) : [])
        : [];
      setCurrentTokens(arr);
    };
    update();
    el.addEventListener("input", update);
    return () => el.removeEventListener("input", update);
  }, [anchorRef]);

  // 마스터 로드
  const { flavors } = useSnackFlavors();
  const { types } = useSnackTypes();

  // ===== 선택 상태 유틸 =====
  const typeNameToId = useMemo(() => {
    const m = new Map(); (types || []).forEach((t) => m.set(t.name, t.id)); return m;
  }, [types]);
  const derivedTypeId = useMemo(() => {
    for (const tok of currentTokens) { const id = typeNameToId.get(tok); if (id) return id; }
    return null;
  }, [currentTokens, typeNameToId]);
  const effectiveTypeId = currentTypeId || derivedTypeId;

  const flavorNameToId = useMemo(() => {
    const m = new Map(); (flavors || []).forEach((f) => m.set(f.name, f.id)); return m;
  }, [flavors]);

  const selectedFlavorIds = useMemo(() => {
    const out = []; for (const tok of currentTokens) { const id = flavorNameToId.get(tok); if (id) out.push(id); }
    return out;
  }, [currentTokens, flavorNameToId]);

  const selectedTypeIds = useMemo(() => {
    const out = []; for (const tok of currentTokens) { const id = typeNameToId.get(tok); if (id) out.push(id); }
    return out;
  }, [currentTokens, typeNameToId]);

  // ===== 가용 카운트 훅(최상위 1회만 호출) =====
  const { countsMap: countsFlavors, loading: loadingFlavors } =
    useAvailableFlavors(effectiveTypeId, selectedFlavorIds, op);
  const { countsMap: countsTypes, loading: loadingTypes } =
    useAvailableTypes(selectedFlavorIds, op);

  // ===== 키워드 로드 =====
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

  // ===== 카탈로그/선택 목록 =====
  const catalogByTab = useMemo(() => ({
    flavors: flavors || [],
    types:   types   || [],
    keywords: keywords || [],
  }), [flavors, types, keywords]);

  // ✅ “태그만” 선택 집계
  const nameSetByTab = useMemo(() => ({
    flavors: new Set((flavors || []).map(x => x.name)),
    types:   new Set((types   || []).map(x => x.name)),
    keywords:new Set((keywords|| []).map(x => x.name)),
  }), [flavors, types, keywords]);

  const selectedTagSet = useMemo(() => {
    const s = new Set();
    const F = nameSetByTab.flavors, T = nameSetByTab.types, K = nameSetByTab.keywords;
    for (const tok of currentTokens) if (F.has(tok) || T.has(tok) || K.has(tok)) s.add(tok);
    return s;
  }, [currentTokens, nameSetByTab]);

  // ===== URL 갱신 유틸 =====
  const replaceSearchWithCurrentQ = () => {
    if (!pathname?.startsWith?.("/search")) return;
    const el = anchorRef?.current; if (!el) return;
    const qVal = (el.value || "").toString();
    // 훅은 한 틱 늦을 수 있으니 최신 URL을 직접 사용
    const raw = typeof window !== "undefined" ? window.location.search : (searchParams?.toString() || "");
    const params = new URLSearchParams(raw);
    params.set("q", qVal);
    params.set("page", "1");
    // op 우선순위: URL > opRef > state
    const opFromURL = (params.get("op") || "").toLowerCase();
    const opFromRef  = (opRef?.current?.value || "").toLowerCase();
    const chosen = (opFromURL === "or" || opFromURL === "and")
      ? opFromURL
      : (opFromRef === "or" || opFromRef === "and" ? opFromRef : normalizeOp(op));
    params.set("op", chosen);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const toggleToken = (name) => {
    const tok = (name || "").trim(); if (!tok) return;
    if (typeof onInsert === "function") { onInsert(tok); return; }
    const el = anchorRef?.current; if (!el) return;
    let tokens = el.value && String(el.value).trim() ? String(el.value).trim().split(/\s+/) : [];
    tokens = tokens.includes(tok) ? tokens.filter((t) => t !== tok) : [...tokens, tok];
    el.value = tokens.join(" ");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    replaceSearchWithCurrentQ();
  };

  const clearSelectedChips = () => {
    const el = anchorRef?.current; if (!el) return;
    const tokens = el.value && String(el.value).trim() ? String(el.value).trim().split(/\s+/) : [];
    const F = nameSetByTab.flavors, T = nameSetByTab.types, K = nameSetByTab.keywords;
    const next = tokens.filter((t) => !(F.has(t) || T.has(t) || K.has(t)));
    if (next.length === tokens.length) return;
    el.value = next.join(" ");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    replaceSearchWithCurrentQ();
  };

  const setOpAndSync = (next) => {
    const val = next === "or" ? "or" : "and";
    setOp(val);
    if (opRef?.current) opRef.current.value = val;
    if (typeof window !== "undefined") localStorage.setItem("search_op", val);
    const params = new URLSearchParams(searchParams?.toString());
    params.set("op", val);
    if (!params.get("page")) params.set("page", "1");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // 필터링(선택 먼저)
  const baseList = catalogByTab[tab];
  const q = norm(filter);
  const filtered = useMemo(() => (q ? baseList.filter((x) => norm(x.name).includes(q)) : baseList), [baseList, q]);
  const [selList, restList] = useMemo(() => {
    const sel = [], rest = [];
    for (const x of filtered) (selectedTagSet.has(x.name) ? sel : rest).push(x);
    return [sel, rest];
  }, [filtered, selectedTagSet]);

  return (
    <div className="tagpick" ref={rootRef}>
      <button type="button" className="tp-btn" aria-expanded={open} onClick={() => setOpen(v=>!v)} title="태그 추가">
        <span aria-hidden>🏷️</span>
      </button>

      {open && (
        <div className="tp-pop" role="dialog" aria-label="태그 선택">
          <div className="tp-actions">
            <div className="tp-actions-left">
              <span className="tp-count">선택 {selectedTagSet.size}</span>

              <div className="tp-op" role="group" aria-label="검색 결합 방식">
                <button type="button" className={`tp-op-btn ${op === "and" ? "on" : ""}`} aria-pressed={op === "and"} onClick={() => setOpAndSync("and")}>그리고</button>
                <button type="button" className={`tp-op-btn ${op === "or" ? "on" : ""}`}  aria-pressed={op === "or"}  onClick={() => setOpAndSync("or")}>또는</button>
              </div>

              <button type="button" className="tp-clear" disabled={!selectedTagSet.size} onClick={clearSelectedChips}>모두 지우기</button>
            </div>

            <div className="tp-actions-right">
              <button type="button" className="tp-close" onClick={() => setOpen(false)} aria-label="닫기">×</button>
            </div>
          </div>

          <div className="tp-tabs">
            <button type="button" className={tab === "flavors" ? "on" : ""} onClick={() => setTab("flavors")}>맛</button>
            <button type="button" className={tab === "types" ? "on" : ""} onClick={() => setTab("types")}>종류</button>
            <button type="button" className={tab === "keywords" ? "on" : ""} onClick={() => setTab("keywords")}>키워드</button>
          </div>

          <div className="tp-filter"><input placeholder="필터 검색" value={filter} onChange={(e) => setFilter(e.target.value)} /></div>

          {!!selList.length && (
            <div className="tp-selected">
              {selList.map((x) => (
                <button type="button" key={`sel-${x.id ?? x.name}`} className="tp-chip on" aria-pressed="true" onClick={() => toggleToken(x.name)}>
                  {x.name}
                </button>
              ))}
            </div>
          )}

          <div className="tp-list">
            {restList.length ? restList.map((x) => {
              const on = selectedTagSet.has(x.name);
              let disabled = false;

              if (tab === "flavors") {
                if (op === "and" && !loadingFlavors) {
                  const c = countsFlavors?.[x.id] ?? 0;
                  disabled = c === 0;
                }
              } else if (tab === "types") {
                if (op === "and" && !loadingTypes) {
                  if (selectedTypeIds.length > 0) {
                    disabled = !selectedTypeIds.includes(x.id);
                  } else {
                    const c = countsTypes?.[x.id] ?? 0;
                    disabled = c === 0;
                  }
                }
              } else {
                disabled = false;
              }

              return (
                <button
                  type="button"
                  key={x.id ?? x.name}
                  className={`tp-chip${on ? " on" : ""}${disabled ? " disabled" : ""}`}
                  aria-pressed={on}
                  onClick={() => !disabled && toggleToken(x.name)}
                  disabled={disabled}
                >
                  {x.name}
                </button>
              );
            }) : <div className="tp-empty">결과 없음</div>}
          </div>
        </div>
      )}

      <style jsx>{`
        .tagpick { position: relative; display:flex; height:100%; align-self:stretch; }
        .tp-btn{
          width: var(--nav-search-size, 40px); min-width: var(--nav-search-size, 40px);
          height: 100%; padding: 0; display:flex; align-items:center; justify-content:center;
          background: var(--nav-search-color, #222); color:#fff; border:0; border-left:1px solid #0000;
          cursor:pointer; font-size: 18px; line-height: 1; box-sizing: border-box;
        }
        .tp-pop{ position:absolute; top: calc(100% + 6px); right: 0; z-index: 30;
          width: min(380px, 90vw); max-height: 60vh; overflow:auto;
          background:#fff; border:1px solid #e6e6e6; border-radius:12px; box-shadow: 0 10px 24px rgba(0,0,0,.08); padding:10px; }
        .tp-actions{ position: sticky; top: 0; z-index: 1; display: flex; justify-content: space-between; align-items: center; gap: 8px; background: #fff; padding: 6px 4px 4px; }
        .tp-actions-left{ display:flex; align-items:center; gap:8px; }
        .tp-actions-right{ display:flex; align-items:center; }
        .tp-count{ font-size:12px; color:#666; }
        .tp-clear{ border:1px solid #ddd; background:#fafafa; border-radius:8px; font-size:12px; padding:4px 8px; cursor:pointer; }
        .tp-clear:disabled{ opacity:.5; cursor:not-allowed; }
        .tp-close{ width:24px; height:24px; line-height:24px; border:0; background:transparent; cursor:pointer; font-size:18px; }
        .tp-selected{ position: sticky; top: 32px; z-index: 1; background:#fff; padding:4px 0 8px; margin-bottom: 6px; display:flex; flex-wrap:wrap; gap:6px; border-bottom:1px dashed #eee; }
        .tp-tabs{ display:flex; gap:6px; margin-bottom:8px; }
        .tp-tabs button{ padding:6px 10px; border:1px solid #ddd; background:#fafafa; border-radius:999px; font-size:12px; }
        .tp-tabs button.on{ background:#eaf3ff; border-color:#d6e8ff; }
        .tp-filter input{ width:100%; padding:8px 10px; border:1px solid #ddd; border-radius:8px; font-size:13px; margin-bottom:8px; }
        .tp-list{ display:flex; flex-wrap:wrap; gap:6px; }

        .tp-pop .tp-chip{
          width: auto !important; height: auto !important;
          background:#fff !important; color: inherit !important;
          border:1px solid #ddd !important; padding:6px 10px !important; border-radius:999px;
          cursor:pointer; font-size:12px;
        }
        .tp-pop .tp-chip.on{ background:#000 !important; color:#fff !important; border-color:#000 !important; }
        .tp-pop .tp-chip.disabled{
          opacity:.45; cursor:not-allowed; background:#f8f8f8 !important; color:#999 !important; border-color:#eee !important;
        }

        .tp-empty{ color:#777; font-size:13px; padding:8px; }
        .tp-op{ display:inline-flex; gap:4px; margin-left:8px; }
        .tp-op-btn{ border:1px solid #ddd; background:#fafafa; border-radius:999px; font-size:12px; padding:4px 10px; cursor:pointer; }
        .tp-op-btn.on{ background:#000; color:#fff; border-color:#000; }
      `}</style>
    </div>
  );
}
