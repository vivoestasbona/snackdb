// widgets/navbar/ui/Navbar.jsx
"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import LoginModal from "@entities/user/ui/LoginModal";
import { getSupabaseClient } from "@shared/api/supabaseClient";

// ✅ 서버에서 넘어온 초기 상태를 props로 받는다.
export default function Navbar({ initialUser = null, initialProfile = null }) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loginReason, setLoginReason] = useState(null);

  // ✅ 초기 렌더에서 서버가 넘겨준 값을 그대로 사용 (플래시 방지)
  const [displayName, setDisplayName] = useState(initialProfile?.display_name ?? null);
  const [email, setEmail] = useState(initialUser?.email ?? null);
  const [role, setRole] = useState(initialProfile?.role ?? null); // 'admin' | 'user' | null

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    const onPrompt = (e) => {
      setLoginReason(e.detail?.reason || null);
      setOpen(true);
    };
    window.addEventListener("app:login-prompt", onPrompt);

    // ✅ 클라이언트에서 확인한 세션이 '서버 초기값'과 다를 때만 갱신
    async function syncFromClient() {
      const { data: sess } = await client.auth.getSession();
      const user = sess?.session?.user ?? null;

      // 서버 초기값과 다르면만 업데이트
      const nextEmail = user?.email ?? null;
      if (nextEmail !== email) setEmail(nextEmail);

      if (user?.id) {
        const { data, error } = await client
          .from("profiles")
          .select("role, display_name")
          .eq("id", user.id)
          .single();

        const nextRole = error ? null : data?.role ?? null;
        const nextName = error ? null : data?.display_name ?? null;

        if (nextRole !== role) setRole(nextRole);
        if (nextName !== displayName) setDisplayName(nextName);
      } else {
        if (role !== null) setRole(null);
        if (displayName !== null) setDisplayName(null);
      }
    }

    syncFromClient();

    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        const user = session?.user ?? null;
        const nextEmail = user?.email ?? null;
        if (nextEmail !== email) setEmail(nextEmail);

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
            const nextRole = error ? null : data?.role ?? null;
            const nextName = error ? null : data?.display_name ?? null;
            if (nextRole !== role) setRole(nextRole);
            if (nextName !== displayName) setDisplayName(nextName);
          });

        // 로그인 성공 시 모달 닫기 + 로깅
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 초기 일치 렌더가 목적이므로 deps 비움

  const handleLogout = async () => {
    const client = getSupabaseClient();
    await client.auth.signOut();
  };

  const nameToShow = displayName || email || ""; // 닉네임 우선, 없으면 이메일 폴백

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
              router.push(v ? `/search?q=${encodeURIComponent(v)}&page=1` : `/search`);
            }}
          >
            <div className="navSearchBox">
              <input
                name="q"
                type="search"
                placeholder="검색"
                aria-label="검색어 입력"
                autoComplete="off"
              />
              <button type="submit" aria-label="검색">
                <span aria-hidden>🔍</span>
              </button>
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
          border: 3px solid var(--nav-search-color);
          overflow: hidden;
          background:#fff;
          height: var(--nav-search-size);
        }
        .navSearchBox :is(input,button){
          border: 0 !important;
          border-radius: 0 !important;
          margin: 0 !important;
          outline: none;
        }
        .navSearchBox input{
          width: min(38vw, 320px);
          padding: 6px 10px;
          background:#fff;
          color:#111;
        }
        .navSearchBox input:focus{
          box-shadow: 0 0 0 2px rgba(0,0,0,.06) inset;
        }
        .navSearchBox button{
          width: var(--nav-search-size);
          padding: 0;
          border: 0 !important;
          background: var(--nav-search-color) !important;
          color:#fff !important;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer;
        }

        .navLinks{
          display: inline-flex;
          align-items: center;
          gap: 18px;
          white-space: nowrap;
          z-index: 1;

          /* ✅ 액션 영역 폭을 최소 보장해 레이아웃 시프트 완화 */
          min-width: 220px; /* 프로젝트에 맞게 조정 가능 */
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

        @media (min-width: 1024px){
          .inner { position: relative; }
          .navSearch {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-48%, -50%);
            z-index: 2;
          }
          .navSearchBox input{
            width: clamp(240px, 25vw, 420px);
          }
        }
        @media (max-width: 1023px){
          .navSearchBox input{
            width: min(38vw, 320px);
          }
        }
      `}</style>
    </>
  );
}
