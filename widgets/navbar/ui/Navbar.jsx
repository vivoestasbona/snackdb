// widgets/navbar/ui/Navbar.jsx
"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import LoginModal from "@entities/user/ui/LoginModal";
import { getSupabaseClient } from "@shared/api/supabaseClient";
import TagPickerButton from "@features/search/ui/TagPickerButton";

export default function Navbar() {
  const router = useRouter();
  const searchRef = useRef(null);
  const opRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loginReason, setLoginReason] = useState(null);
  const [displayName, setDisplayName] = useState(null); // 닉네임
  const [email, setEmail] = useState(null);             // 폴백용/내부용
  const [role, setRole] = useState(null);               // 'admin' | 'user' | null

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    //  전역 프롬프트 이벤트 → 로그인 모달 열기
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

          //  로그인 성공 시 모달 닫기 + 사유 초기화
          setOpen(false);
          setLoginReason(null);

          // 로그인 성공 후 모달 닫는 기존 코드 옆에 추가
          try {
            const from = localStorage.getItem("lp_last_from") || null;
            localStorage.removeItem("lp_last_from");
            if (from) {
              const data = JSON.stringify({ event: "login_success", from, path: window.location?.pathname || null });
              if (navigator.sendBeacon) {
                navigator.sendBeacon("/api/metrics/login-prompt", new Blob([data], { type: "application/json" }));
              } else {
                fetch("/api/metrics/login-prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: data });
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

  const nameToShow = displayName || email || ""; // 닉네임 우선, 없으면 이메일로 잠깐 폴백

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
              const v = e.currentTarget.q.value.trim();
              const op = (e.currentTarget.op?.value || "and").toLowerCase() === "or" ? "or" : "and";
              const base = v ? `/search?q=${encodeURIComponent(v)}&page=1` : `/search?page=1`;
              router.push(`${base}&op=${op}`);
            }}
          >
            <div className="navSearchBox">
              <input
                name="q"
                type="search"
                placeholder="검색"
                aria-label="검색어 입력"
                autoComplete="off"
                ref={searchRef}
              />
              <input type="hidden" name="op" defaultValue="and" ref={opRef} />
              <button type="submit" aria-label="검색">
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

      <LoginModal
        open={open}
        onClose={() => { setOpen(false); setLoginReason(null); }}
        reason={loginReason}
      />

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
        .right {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        
        button {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: #f8f8f8;
          cursor: pointer;
          color: #222;          
          font-size: 14px;
        }
        .admin {
          padding: 8px 12px;
          border: 1px solid #c9defc;
          border-radius: 8px;
          background: #eaf3ff;
          text-decoration: none;
          color: #0b57d0;
          font-weight: 600;
        }
        .admin:hover { background: #dbeaff; }

        :global(a.nameLink) {
          text-decoration: none;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: #f8f8f8;
          color: #555;
          font-size: 14px;
          display: inline-block;
        }
        :global(a.nameLink:hover) { background: #f0f0f0; }

        .logoutBtn { /* 가독성 유지용(선택) */
          background: #f8f8f8;
        }

        :global(:root) { --nav-search-color: #000; --nav-search-size:44px; }

        .navSearch { display:flex; align-items:center; }

        .navSearchBox{
          display:inline-flex; 
          align-items:stretch;
          height:36px;
          border: 3px solid var(--nav-search-color);     /*  바깥 테두리 한 번만 */
          // border-radius: 3px;
          overflow: visible;                    
          background:#fff;
          height: var(--nav-search-size);
        }

        /* 3) 내부 요소는 보더/라운드/마진 제거로 래퍼와 일체화 */
        .navSearchBox > :is(input,button){
          border: 0 !important;
          border-radius: 0 !important;
          margin: 0 !important;
          outline: none;
        }

        /* 4) 인풋 폭, 패딩 */
        .navSearchBox input{
          width: min(38vw, 320px);
          padding: 6px 10px;
          background:#fff;
          color:#111;
        }
        .navSearchBox input:focus{
          box-shadow: 0 0 0 2px rgba(0,0,0,.06) inset;
        }

        /* 5) 우측 버튼 */
        .navSearchBox > button{
          width: var(--nav-search-size);         /* ← 너비 = 높이 */
          padding: 0;                            /* 내부 패딩 제거 */
          border: 0 !important;
          background: var(--nav-search-color) !important;
          color:#fff !important;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer;
        }
        .navSearch button:active{ transform: translateY(0.5px); }

        /* ───────── Nav 우측 액션: 텍스트 링크 통일 ───────── */

        .navLinks{
          display: inline-flex;
          align-items: center;
          gap: 18px;
          white-space: nowrap;
          z-index: 1;
        }

        /* a, button 모두 동일한 “텍스트 링크” 룩으로 리셋 (styled-jsx 호환을 위해 :global(a)도 함께) */
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

        /* 방문/호버/활성/포커스 상태도 텍스트 그대로 */
        .navLinks :global(a):link,
        .navLinks :global(a):visited,
        .navLinks :global(a):hover,
        .navLinks button:hover{
          color:#111 !important;
          text-decoration:none !important;
        }
        .navLinks :global(a):active,
        .navLinks button:active{ opacity:.85; }
        .navLinks :global(a):focus-visible,
        .navLinks button:focus-visible{
          outline:2px solid #000;
          outline-offset:2px;
          border-radius:4px;
        }

        /* 과거 칩 스타일( a.nameLink )가 남아 있을 경우 완전 무효화 */
        :global(a.nameLink){
          background: transparent !important;
          border: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          color: #111 !important;
          text-decoration: none !important;
        }

      @media (min-width: 1024px){
        .inner { position: relative; }
        .navSearch {                                      /* 폼 */
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-48%, -50%);
          z-index: 2;
        }
        /* 데스크탑 폭: 살짝 더 짧게 */
        .navSearchBox input{
          width: clamp(240px, 25vw, 420px);               /* 취향에 맞게 값만 조절 */
        }
      }

      /* 모바일/태블릿(기존 폭 유지) */
      @media (max-width: 1023px){
        .navSearchBox input{
          width: min(38vw, 320px);
        }
      }

      `}</style>
    </>
  );
}
