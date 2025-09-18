// widgets/navbar/ui/Navbar.jsx
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import LoginModal from "@entities/user/ui/LoginModal";
import { getSupabaseClient } from "@shared/api/supabaseClient";
import TagPickerButton from "@features/search/ui/TagPickerButton";
import { getSnackFlavors } from "@entities/snack/model/getSnackFlavors";
import { getSnackTypes } from "@entities/snack/model/getSnackTypes";

export default function Navbar() {
  const router = useRouter();
  const sp = useSearchParams();

  // 검색 입력 레퍼런스(오프스크린 텍스트 인풋: TagPicker가 focus/setSelectionRange 가능)
  const searchRef = useRef(null);
  const chipInputRef = useRef(null);
  const opRef = useRef(null);

  // 로그인 상태
  const [open, setOpen] = useState(false);
  const [loginReason, setLoginReason] = useState(null);
  const [displayName, setDisplayName] = useState(null);
  const [email, setEmail] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    const onPrompt = (e) => {
      setLoginReason(e.detail?.reason || null);
      setOpen(true);
    };
    window.addEventListener("app:login-prompt", onPrompt);

    async function init() {
      const { data: sess } = await client.auth.getSession();
      const user = sess?.session?.user ?? null;
      setEmail(user?.email ?? null);

      if (user) {
        const { data, error } = await client
          .from("profiles")
          .select("role, display_name")
          .eq("id", user.id)
          .single();

        setRole(error ? null : data?.role ?? null);
        setDisplayName(error ? null : data?.display_name ?? null);
      } else {
        setRole(null);
        setDisplayName(null);
      }
    }

    init();

    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        const user = session?.user ?? null;
        setEmail(user?.email ?? null);

        if (!user) {
          setRole(null);
          setDisplayName(null);
          return;
        }

        client
          .from("profiles")
          .select("role, display_name")
          .eq("id", user.id)
          .single()
          .then(({ data, error }) => {
            setRole(error ? null : data?.role ?? null);
            setDisplayName(error ? null : data?.display_name ?? null);
          });

        // 로그인 성공 시 모달 닫기 + 사유 초기화 + 간단 비콘
        setOpen(false);
        setLoginReason(null);
        try {
          const from = localStorage.getItem("lp_last_from") || null;
          localStorage.removeItem("lp_last_from");
          if (from) {
            const payload = JSON.stringify({
              event: "login_success",
              from,
              path: window.location?.pathname || null,
            });
            if (navigator.sendBeacon) {
              navigator.sendBeacon("/api/metrics/login-prompt", new Blob([payload], { type: "application/json" }));
            } else {
              fetch("/api/metrics/login-prompt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: payload,
              });
            }
          }
        } catch {}
      }
      if (event === "SIGNED_OUT") {
        setEmail(null);
        setRole(null);
        setDisplayName(null);
      }
    });

    return () => {
      sub?.subscription?.unsubscribe?.();
      window.removeEventListener("app:login-prompt", onPrompt);
    };
  }, []);

  const handleLogout = async () => {
    const client = getSupabaseClient();
    await client.auth.signOut();
  };
  const nameToShow = displayName || email || "";

  // ---------- 태그 마스터 로딩(표시용 구분: TAG 배지/색상) ----------
  const [flavors, setFlavors] = useState([]);
  const [types, setTypes] = useState([]);
  const [keywords, setKeywords] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const [f, t] = await Promise.all([getSnackFlavors(), getSnackTypes()]);
        setFlavors(f || []);
        setTypes(t || []);
        const supa = getSupabaseClient();
        const { data: ks } = await supa.from("snack_keywords").select("id,name").eq("is_active", true);
        setKeywords(ks || []);
      } catch {}
    })();
  }, []);
  const flavorSet = useMemo(() => new Set((flavors || []).map((v) => v.name)), [flavors]);
  const typeSet = useMemo(() => new Set((types || []).map((v) => v.name)), [types]);
  const keywordSet = useMemo(() => new Set((keywords || []).map((v) => v.name)), [keywords]);
  const chipClass = (tok) => {
    if (flavorSet.has(tok)) return "chip--flavor";
    if (typeSet.has(tok)) return "chip--type";
    if (keywordSet.has(tok)) return "chip--keyword";
    return "chip--text";
  };

  // ---------- 칩 입력 상태 ----------
  const [tokens, setTokens] = useState([]); // 칩으로 표시되는 토큰들
  const [typing, setTyping] = useState(""); // 칩 입력칸 현재 텍스트

  const [showAll, setShowAll] = useState(false); // 요약 칩 클릭 시 전체 토큰 팝오버
  const moreRef = useRef(null);
  const popRef = useRef(null)

  // hidden q <-> tokens 동기화
  const syncHiddenFromTokens = (next) => {
    const qEl = searchRef.current;
    if (!qEl) return;
    qEl.value = next.join(" ");
    qEl.dispatchEvent(new Event("input", { bubbles: true })); // TagPicker가 input 이벤트를 구독
  };
  const setTokensSafe = (next) => {
    setTokens(next);
    syncHiddenFromTokens(next);
  };
  const addToken = (tok) => {
    const t = (tok || "").trim();
    if (!t) return;
    if (tokens.includes(t)) return;
    setTokensSafe([...tokens, t]);
    setTyping("");
    chipInputRef.current?.focus();
  };
  const removeTokenAt = (idx) => {
    const next = tokens.slice();
    next.splice(idx, 1);
    setTokensSafe(next);
    chipInputRef.current?.focus();
  };

  // URL(q/op) → 칩/히든 초기화
  useEffect(() => {
    const q = sp.get("q") || "";
    const op = (sp.get("op") || "and").toLowerCase() === "or" ? "or" : "and";
    const parts = q.trim() ? q.trim().split(/\s+/) : [];
    setTokens(parts);
    syncHiddenFromTokens(parts);
    if (opRef.current && opRef.current.value !== op) opRef.current.value = op;
    setTyping("");
    setShowAll(false);
  }, [sp]);

  // TagPicker가 hidden q를 직접 변경(토글)할 때 → 칩도 동기화
  useEffect(() => {
    const qEl = searchRef.current;
    if (!qEl) return;
    const onInput = () => {
      const v = qEl.value || "";
      setTokens(v.trim() ? v.trim().split(/\s+/) : []);
    };
    qEl.addEventListener("input", onInput);
    return () => qEl.removeEventListener("input", onInput);
  }, []);

  // ESC로 팝오버 닫기
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setShowAll(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="nav">
        <div className="inner">
          <div className="logo">
            <Link href="/">SnackDB</Link>
          </div>

          <form
            className="navSearch"
            onSubmit={(e) => {
              e.preventDefault();
              // 제출 직전 타이핑 텍스트를 토큰으로 편입
              const tail = typing.trim();
              const finalTokens = tail ? [...tokens, tail] : tokens;
              const qStr = finalTokens.join(" ");
              if (searchRef.current) searchRef.current.value = qStr;
              const v = qStr;
              const op = (e.currentTarget.op?.value || "and").toLowerCase() === "or" ? "or" : "and";
              const base = v ? `/search?q=${encodeURIComponent(v)}&page=1` : `/search?page=1`;
              router.push(`${base}&op=${op}`);
              setTyping("");
            }}
          >
            <div className="navSearchBox">
              {/* 오프스크린 텍스트 인풋: TagPicker가 focus/입력 이벤트를 정상 사용 */}
              <input
                name="q"
                type="text"
                ref={searchRef}
                autoComplete="off"
                aria-hidden="true"
                className="srOnlyInput"
              />

              {/* 칩 컨테이너 + 미니 입력칸 */}
              <div
                className="chipBox"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) chipInputRef.current?.focus();
                }}
              >
                {(() => {
                  const MAX = 1; // ✅ 1개만 표시
                  const total = tokens.length;
                  const visible = tokens.slice(0, MAX);
                  return (
                    <>
                      {visible.map((t, i) => {
                        const idx = i;
                        const cls = chipClass(t);
                        return (
                          <span
                            className={`chip ${cls} clickable`}
                            key={`${t}-${idx}`}
                            title="검색 토큰"
                            onClick={() => setShowAll((v) => !v)}   // ✅ 칩 전체 클릭으로 팝오버 토글
                          >
                            <span className="chipText">
                              {t}
                              {total > MAX && (
                                <span
                                  className="chipMoreIn"
                                  title={`${total - MAX}개 더 있음`}
                                  aria-hidden="true"
                                >
                                  &nbsp;… +{total - MAX}
                                </span>
                              )}
                            </span>
                            <button
                              type="button"
                              className="chipX"
                              aria-label={`${t} 삭제`}
                              onClick={(e) => { e.stopPropagation(); removeTokenAt(idx); }}
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </>
                  );
                })()}

                <input
                  ref={chipInputRef}
                  className="chipInput"
                  type="text"
                  placeholder={tokens.length ? "" : "검색"}
                  aria-label="검색어 입력"
                  autoComplete="off"
                  value={typing}
                  onChange={(e) => setTyping(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter/Space/Comma → 토큰 확정
                    if (["Enter", " ", ","].includes(e.key)) {
                      const cand = typing.trim();
                      if (cand) addToken(cand);
                      e.preventDefault();
                      return;
                    }
                    // 백스페이스: 비어 있을 때 마지막 칩 삭제
                    if (e.key === "Backspace" && typing === "" && tokens.length) {
                      // 마지막 토큰 제거(요약 칩이 있어도 실제 배열 기준)
                      const idx = tokens.length - 1;
                      const next = tokens.slice(0, idx);
                      setTokensSafe(next);
                      e.preventDefault();
                    }
                  }}
                  onPaste={(e) => {
                    const text = (e.clipboardData?.getData("text") || "").trim();
                    if (!text) return;
                    const parts = text.split(/\s+/).filter(Boolean);
                    if (!parts.length) return;
                    e.preventDefault();
                    const uniq = [...new Set([...tokens, ...parts])];
                    setTokensSafe(uniq);
                  }}
                />
              </div>
              {showAll && (
                <>
                  <div className="popMask" onClick={() => setShowAll(false)} />
                  <div className="tokenPopover" ref={popRef} role="dialog" aria-label="전체 검색어">
                    <div className="tokenHead">
                      <span>전체 검색어 <span className="count">{tokens.length}</span></span>
                      <button type="button" className="popClose" aria-label="닫기" onClick={() => setShowAll(false)}>×</button>
                    </div>
                    <div className="tokenList">
                      {tokens.map((t, i) => (
                        <span
                          key={`${t}-${i}`}
                          className={`chip ${chipClass(t)} clickable`}
                          title="클릭하면 삭제"
                          onClick={() => removeTokenAt(i)}              // ✅ 팝오버 내 토큰 칩 전체 클릭 = 삭제
                        >
                          <span className="chipText">{t}</span>
                          <button
                            type="button"
                            className="chipX"
                            aria-label={`${t} 삭제`}
                            onClick={(e) => { e.stopPropagation(); removeTokenAt(i); }} // ✅ X도 그대로 작동
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <input type="hidden" name="op" defaultValue="and" ref={opRef} />
              <button type="submit" aria-label="검색">
                <span aria-hidden>🔍</span>
              </button>

              <TagPickerButton anchorRef={searchRef} opRef={opRef} />
            </div>
          </form>

          <nav className="navLinks">
            {role === "admin" && <Link href="/admin" className="navLink">관리</Link>}

            {nameToShow ? (
              <>
                <Link href="/account" className="navLink">{nameToShow}</Link>
                <button type="button" className="navLink" onClick={handleLogout}>로그아웃</button>
              </>
            ) : (
              <button type="button" className="navLink" onClick={() => setOpen(true)}>로그인</button>
            )}
          </nav>
        </div>
      </header>

      <LoginModal open={open} onClose={() => { setOpen(false); setLoginReason(null); }} reason={loginReason} />

      <style jsx>{`
        .nav {
          position: sticky;
          top: 0;
          background: #ffffffcc;
          backdrop-filter: blur(6px);
          border-bottom: 1px solid #eee;
          z-index: 1000;
        }
        .inner {
          max-width: var(--container-max);
          margin: 0 auto;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 56px;
        }
        .logo :global(a) {
          font-weight: 700;
          color: inherit;
          text-decoration: none;
        }

        :global(:root) { --nav-search-color: #000; --nav-search-size:44px; }
        .navSearch { display:flex; align-items:center; }

        .navSearchBox{
          display:inline-flex;
          align-items:stretch;
          height: var(--nav-search-size);
          border: 3px solid var(--nav-search-color);
          overflow: visible;
          background:#fff;
          position: relative; /* 팝오버 앵커 */
        }

        .navSearchBox > :is(input,button){
          border: 0 !important;
          border-radius: 0 !important;
          margin: 0 !important;
          outline: none;
        }

        /* 칩 박스(칩 + 미니 인풋) */
        .chipBox{
          display:flex; align-items:center; flex-wrap:wrap;
          gap:6px;
          padding: 6px 10px;
          width: min(38vw, 320px);
        }
        .chip{
          display:inline-flex; align-items:center; gap:6px;
          padding: 4px 8px; border-radius:999px;
          font-size:12px; line-height:1;
          background:#f6f8fb; border:1px solid #e5e7eb; color:#111;
        }
        .chip.clickable{ cursor: pointer; }
        .chip.clickable:hover{ filter: brightness(0.98); }
        .chipText{ max-width: 160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .chipX{
          border:0; background:transparent; cursor:pointer;
          font-size:14px; line-height:1; color:#444; padding:0; margin:0;
        }
        .chipX:hover{ color:#000; }
        .chipInput{
          min-width: 80px; flex: 1 1 80px;
          border:0; outline:0; font: inherit; color:#111; background:#fff;
        }
        .chipInput::placeholder{ color:#999; }
        .chipInput:focus{ box-shadow: 0 0 0 2px rgba(0,0,0,.06) inset; }

        .chip--type{    background:#e8f1ff; color:#0d47a1; border-color:#d9e6ff; }
        .chip--flavor{  background:#ffe9f2; color:#ad1457; border-color:#ffd4e4; }
        .chip--keyword{ background:#eaf7ea; color:#1b5e20; border-color:#d5f0d5; }
        .chip--text{    background:#f6f8fb; color:#111;    border-color:#e5e7eb; }

        /* 칩 내부 요약 버튼 */
        .chipMoreIn{
          opacity: .8;
          font: inherit;
        }

        /* ▼ 팝오버 */
        .popMask{
          position: fixed; inset: 0;
          background: transparent;
          z-index: 4;
        }
        .tokenPopover{
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          min-width: 280px;
          max-width: 520px;
          max-height: 320px;
          overflow: auto;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,.12);
          padding: 10px;
          z-index: 5;
        }
        .tokenHead{
          display:flex; align-items:center; justify-content:space-between;
          font-size:12px; color:#333; margin-bottom:6px;
        }
        .tokenHead .count{ font-weight:600; margin-left:4px; }
        .popClose{
          border:0; background:transparent; cursor:pointer;
          font-size:18px; line-height:1; color:#555;
        }
        .popClose:hover{ color:#000; }
        .tokenList{
          display:flex; flex-wrap:wrap; gap:6px;
        }

        /* 우측 제출 버튼 */
        .navSearchBox > button{
          width: var(--nav-search-size);
          padding: 0;
          border: 0 !important;
          background: var(--nav-search-color) !important;
          color:#fff !important;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer;
        }
        .navSearch button:active{ transform: translateY(0.5px); }

        .navLinks{
          display: inline-flex;
          align-items: center;
          gap: 18px;
          white-space: nowrap;
          z-index: 1;
        }
        .navLinks :global(a),
        .navLinks button{
          appearance: none;
          -webkit-appearance: none;
          background: transparent !important;
          border: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
          border-radius: 0 !important;
          font: inherit;
          line-height: 1;
          color: #111 !important;
          text-decoration: none !important;
          cursor: pointer;
        }
        .navLinks :global(a):active,
        .navLinks button:active{ opacity:.85; }
        .navLinks :global(a):focus-visible,
        .navLinks button:focus-visible{
          outline:2px solid #000;
          outline-offset:2px;
          border-radius:4px;
        }

        /* TagPicker용 오프스크린 입력 */
        .srOnlyInput{
          position: absolute;
          left: -9999px;
          width: 1px; height: 1px;
          opacity: 0; pointer-events: none;
        }

        @media (min-width: 1024px){
          .inner { position: relative; }
          .navSearch {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-48%, -50%);
            z-index: 2;
          }
          .chipBox{
            width: clamp(240px, 25vw, 420px);
          }
          .tokenPopover{
            max-width: clamp(280px, 30vw, 520px);
          }

        }
        @media (max-width: 1023px){
          .chipBox{
            width: min(38vw, 320px);
          }
        }
      `}</style>
    </>
  );
}
