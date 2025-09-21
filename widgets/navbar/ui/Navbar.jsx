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

  const searchRef = useRef(null);   // 오프스크린 입력 (TagPicker 앵커)
  const chipInputRef = useRef(null);
  const opRef = useRef(null);       // 숨김 input의 ref (TagPicker가 갱신)

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

  // ---------- 태그 마스터 ----------
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
  const isTagToken = (tok) => flavorSet.has(tok) || typeSet.has(tok) || keywordSet.has(tok);

  const chipClass = (tok) => {
    if (flavorSet.has(tok)) return "chip--flavor";
    if (typeSet.has(tok)) return "chip--type";
    if (keywordSet.has(tok)) return "chip--keyword";
    return "chip--text";
  };

  // ---------- 칩/타이핑 ----------
  const [tokens, setTokens] = useState([]);   // 태그 칩만
  const [typing, setTyping] = useState("");   // 자유 텍스트만
  const [showAll, setShowAll] = useState(false);

  // 뒤 공백 보존하여 hidden q 동기화
  const syncHiddenFromTokens = (nextTokens) => {
    const qEl = searchRef.current;
    if (!qEl) return;
    const base = (nextTokens || []).join(" ");
    const v = typing !== "" ? (base ? `${base} ${typing}` : typing) : base;
    qEl.value = v;
    qEl.dispatchEvent(new Event("input", { bubbles: true }));
  };

  // URL → 칩/타이핑 초기화 (opRef는 건드리지 않음! TagPicker가 관리)
  useEffect(() => {
    const q = sp.get("q") || "";
    const parts = q.trim() ? q.trim().split(/\s+/) : [];
    const tagTokens = parts.filter(isTagToken);
    const freeText  = parts.filter((t) => !isTagToken(t)).join(" ");
    setTokens(tagTokens);
    setTyping(freeText);
    const qEl = searchRef.current;
    if (qEl) {
      const base = tagTokens.join(" ");
      qEl.value = freeText ? (base ? `${base} ${freeText}` : freeText) : base;
      qEl.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setShowAll(false);
  }, [sp]); // eslint-disable-line react-hooks/exhaustive-deps

  // TagPicker가 hidden q를 변경했을 때 반영(타이핑 중이면 보존)
  useEffect(() => {
    const qEl = searchRef.current;
    if (!qEl) return;
    const onInput = () => {
      if (document.activeElement === chipInputRef.current) return; // 타이핑 중이면 덮지 않음
      const v = qEl.value || "";
      const parts = v.trim() ? v.trim().split(/\s+/) : [];
      const tagTokens = parts.filter(isTagToken);
      const freeText  = parts.filter((t) => !isTagToken(t)).join(" ");
      setTokens(tagTokens);
      setTyping(freeText);
    };
    qEl.addEventListener("input", onInput);
    return () => qEl.removeEventListener("input", onInput);
  }, [flavorSet, typeSet, keywordSet, chipInputRef]);

  // ESC로 팝오버 닫기
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setShowAll(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    const v = (searchRef.current?.value || "").trim();
    // ✅ op 우선순위: URL > form(opRef) > local(opRef again)
    const byURL  = sp.get("op");
    const byRef  = e.currentTarget.op?.value;
    const bySave = opRef.current?.value;
    const op = (((byURL ?? byRef ?? bySave ?? "and").toLowerCase()) === "or") ? "or" : "and";
    const base = v ? `/search?q=${encodeURIComponent(v)}&page=1` : `/search?page=1`;
    router.push(`${base}&op=${op}`);
    setShowAll(false);
  }

  return (
    <>
      <header className="nav">
        <div className="inner">
          <div className="logo">
            <Link href="/">SnackDB</Link>
          </div>

          <form className="navSearch" onSubmit={handleSubmit}>
            <div className="navSearchBox">
              {/* 오프스크린 입력(Anchor) */}
              <input name="q" type="text" ref={searchRef} autoComplete="off" aria-hidden="true" className="srOnlyInput" />

              {/* 칩 + 미니 입력 */}
              <div
                className="chipBox"
                onMouseDown={(e) => { if (e.target === e.currentTarget) chipInputRef.current?.focus(); }}
              >
                {(() => {
                  const MAX = 1;
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
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setShowAll(true); }}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowAll(true); }}
                          >
                            <span className="chipText">
                              {t}
                              {total > MAX && (
                                <span className="chipMoreIn" title={`${total - MAX}개 더 있음`} aria-hidden="true">
                                  &nbsp;… +{total - MAX}
                                </span>
                              )}
                            </span>
                            <button
                              type="button"
                              className="chipX"
                              aria-label={`${t} 삭제`}
                              onClick={(e) => {
                                e.stopPropagation(); e.preventDefault();
                                const next = tokens.filter((_, ii) => ii !== idx);
                                setTokens(next);
                                syncHiddenFromTokens(next);
                              }}
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
                  id="nav-search-visible"
                  ref={chipInputRef}
                  className="chipInput"
                  type="text"
                  placeholder={tokens.length === 0 && typing === "" ? "검색" : ""}
                  aria-label="검색어 입력"
                  autoComplete="off"
                  value={typing}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTyping(val);
                    const qEl = searchRef.current;
                    if (qEl) {
                      const base = tokens.join(" ");
                      qEl.value = val !== "" ? (base ? `${base} ${val}` : val) : base;
                      qEl.dispatchEvent(new Event("input", { bubbles: true }));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit?.();
                      return;
                    }
                    if (e.key === "Backspace" && typing === "" && tokens.length) {
                      const next = tokens.slice(0, -1);
                      setTokens(next);
                      syncHiddenFromTokens(next);
                      e.preventDefault();
                    }
                  }}
                  onPaste={(e) => {
                    const text = (e.clipboardData?.getData("text") || "").trim();
                    if (!text) return;
                    e.preventDefault();
                    const val = typing ? `${typing} ${text}` : text;
                    const normalized = val.replace(/\s+/g, " ").trim();
                    setTyping(normalized);
                    const qEl = searchRef.current;
                    if (qEl) {
                      const base = tokens.join(" ");
                      qEl.value = normalized ? (base ? `${base} ${normalized}` : normalized) : base;
                      qEl.dispatchEvent(new Event("input", { bubbles: true }));
                    }
                  }}
                />
              </div>

              {/* 토큰 팝오버 */}
              {showAll && (
                <>
                  <div className="popMask" onClick={() => setShowAll(false)} />
                  <div className="tokenPopover" role="dialog" aria-label="전체 검색어">
                    <div className="tokenHead">
                      <span>
                        전체 검색어 <span className="count">{tokens.length}</span>
                      </span>
                      <button type="button" className="popClose" aria-label="닫기" onClick={() => setShowAll(false)}>×</button>
                    </div>
                    <div className="tokenList">
                      {tokens.map((t, i) => (
                        <span
                          key={`${t}-${i}`}
                          className={`chip ${chipClass(t)} clickable`}
                          title="클릭하면 삭제"
                          onMouseDown={(e) => {
                            e.preventDefault(); e.stopPropagation();
                            const next = tokens.filter((_, ii) => ii !== i);
                            setTokens(next);
                            syncHiddenFromTokens(next);
                          }}
                          onClick={(e) => {
                            e.preventDefault(); e.stopPropagation();
                            const next = tokens.filter((_, ii) => ii !== i);
                            setTokens(next);
                            syncHiddenFromTokens(next);
                          }}
                        >
                          <span className="chipText">{t}</span>
                          <button
                            type="button"
                            className="chipX"
                            aria-label={`${t} 삭제`}
                            onClick={(e) => {
                              e.stopPropagation(); e.preventDefault();
                              const next = tokens.filter((_, ii) => ii !== i);
                              setTokens(next);
                              syncHiddenFromTokens(next);
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ✅ 기본값을 넣지 않는다: TagPicker가 관리 */}
              <input type="hidden" name="op" ref={opRef} />
              <button type="submit" aria-label="검색" className="searchBtn">
                <span aria-hidden>🔍</span>
              </button>

              <TagPickerButton anchorRef={searchRef} opRef={opRef} />
            </div>
          </form>

          <nav className="navLinks">
            {role === "admin" && (
              <Link href="/admin" className="navLink">관리</Link>
            )}
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
          position: sticky; top: 0; background: #ffffffcc; backdrop-filter: blur(6px);
          border-bottom: 1px solid #eee; z-index: 1000;
        }
        .inner { max-width: var(--container-max); margin: 0 auto; padding: 10px 16px;
          display: flex; align-items: center; justify-content: space-between; height: 56px; }
        .logo :global(a) { font-weight: 700; color: inherit; text-decoration: none; }

        :global(:root) { --nav-search-color: #000; --nav-search-size: 44px; }
        .navSearch { display: flex; align-items: center; z-index: 2; }
        .navSearchBox {
          display: inline-flex; align-items: stretch; height: var(--nav-search-size);
          border: 3px solid var(--nav-search-color); overflow: visible; background: #fff; position: relative;
        }
        .navSearchBox > :is(input, button){ border:0 !important; border-radius:0 !important; margin:0 !important; outline:none; }

        .chipBox { display:flex; align-items:center; flex-wrap:wrap; gap:6px; padding:6px 10px; width:min(38vw, 320px); }
        .chip { display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border-radius:999px;
          font-size:12px; line-height:1; background:#f6f8fb; border:1px solid #e5e7eb; color:#111; }
        .chip.clickable{ cursor:pointer; } .chip.clickable:hover{ filter:brightness(.98); }
        .chipText{ max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .chipX{ border:0; background:transparent; cursor:pointer; font-size:14px; line-height:1; color:#444; padding:0; margin:0; }
        .chipX:hover{ color:#000; }
        .chipInput{ min-width:80px; flex:1 1 80px; border:0; outline:0; font:inherit; color:#111; background:#fff; }
        .chipInput::placeholder{ color:#999; } .chipInput:focus{ box-shadow:0 0 0 2px rgba(0,0,0,.06) inset; }
        .chip--type{ background:#e8f1ff; color:#0d47a1; border-color:#d9e6ff; }
        .chip--flavor{ background:#ffe9f2; color:#ad1457; border-color:#ffd4e4; }
        .chip--keyword{ background:#eaf7ea; color:#1b5e20; border-color:#d5f0d5; }
        .chip--text{ background:#f6f8fb; color:#111; border-color:#e5e7eb; }
        .chipMoreIn{ opacity:.8; font:inherit; }

        .popMask{ position:fixed; inset:0; background:transparent; z-index:4; }
        .tokenPopover{
          position:absolute; top:calc(100% + 8px); left:0; min-width:280px; max-width:520px; max-height:320px; overflow:auto;
          background:#fff; border:1px solid #e5e7eb; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.12); padding:10px; z-index:5;
        }
        .tokenHead{ display:flex; align-items:center; justify-content:space-between; font-size:12px; color:#333; margin-bottom:6px; }
        .tokenHead .count{ font-weight:600; margin-left:4px; }
        .popClose{ border:0; background:transparent; cursor:pointer; font-size:18px; line-height:1; color:#555; }
        .popClose:hover{ color:#000; }
        .tokenList{ display:flex; flex-wrap:wrap; gap:6px; }

        .srOnlyInput{ position:absolute; left:-9999px; width:1px; height:1px; opacity:0; pointer-events:none; }

        .searchBtn{
          flex:0 0 var(--nav-search-size); width:var(--nav-search-size); min-width:var(--nav-search-size);
          height:100%; align-self:stretch; display:flex; align-items:center; justify-content:center;
          background:var(--nav-search-color) !important; color:#fff !important; border:0 !important; padding:0 !important; margin:0 !important;
          outline:none; cursor:pointer; -webkit-appearance:none; appearance:none; box-sizing:border-box;
        }
        .searchBtn > span{ font-size:18px; line-height:1; display:inline-block; }
        .searchBtn:hover{ filter:brightness(.96); } .searchBtn:active{ transform:translateY(.5px); }
        .searchBtn:focus-visible{ outline:2px solid #000; outline-offset:2px; border-radius:4px; }

        /* 우측 네비 링크/버튼 컨테이너 리셋 (견고) */
        .navLinks{ position:relative; z-index:3; display:inline-flex; align-items:center; gap:18px; white-space:nowrap; }
        .navLinks :global(a), .navLinks button, .navLink{
          -webkit-appearance:none; appearance:none; background:transparent !important; border:0 !important;
          padding:0 !important; margin:0 !important; border-radius:0 !important; font:inherit; line-height:1;
          color:#111 !important; text-decoration:none !important; cursor:pointer;
        }
        .navLinks :global(a):visited, .navLink:visited{ color:#111 !important; }
        .navLinks :global(a):active, .navLinks button:active, .navLink:active{ opacity:.85; }
        .navLinks :global(a):focus-visible, .navLinks button:focus-visible, .navLink:focus-visible{
          outline:2px solid #000; outline-offset:2px; border-radius:4px;
        }

        @media (min-width:1024px){
          .inner{ position:relative; }
          .navSearch{ position:absolute; left:50%; top:50%; transform:translate(-48%, -50%); z-index:2; }
          .chipBox{ width: clamp(240px, 25vw, 420px); }
          .tokenPopover{ max-width: clamp(280px, 30vw, 520px); }
        }
        @media (max-width:1023px){
          .chipBox{ width:min(38vw, 320px); }
        }
      `}</style>
    </>
  );
}
