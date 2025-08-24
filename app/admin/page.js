// app/admin/page.js
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabaseClient";

export default function AdminHome() {
  const router = useRouter();
  const [state, setState] = useState({ loading: true, email: null, error: "" });

  useEffect(() => {
    let mounted = true;
    const client = getSupabaseClient();
    if (!client) return;

    async function resolveSession(session) {
      if (!session) {
        router.replace("/");
        return;
      }
      const user = session.user;
      const { data, error } = await client
        .from("profiles")
        .select("role, email")
        .eq("id", user.id)
        .single();
      if (error || data?.role !== "admin") {
        router.replace("/");
        return;
      }
      if (!mounted) return;
      setState({
        loading: false,
        email: data.email ?? user.email ?? "",
        error: "",
      });
    }

    // 1) 즉시 한 번 확인 (세션이 있으면 바로 통과)
    client.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data?.session) resolveSession(data.session);
    });

    // 2) 세션 복원/변경 이벤트 처리 (구독은 딱 1개만!)
    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED"
      ) {
        resolveSession(session);
      }
      if (event === "SIGNED_OUT") {
        router.replace("/");
      }
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, [router]);

  if (state.loading) {
    return (
      <section className="wrap">
        <div className="card">
          <h1>관리자 확인 중…</h1>
          <p>잠시만 기다려 주세요.</p>
        </div>
        <style jsx>{styles}</style>
      </section>
    );
  }

  return (
    <section className="wrap">
      <div className="card">
        <h1>관리자 홈</h1>
        <p className="hint">
          환영합니다{state.email ? `, ${state.email}` : ""}.
        </p>

        <div className="grid">
          <Link href="/admin/snacks" className="tile">
            <div className="tile">
              <strong>과자 관리</strong>
              <span>목록/검색/수정/삭제</span>
            </div>
          </Link>

          <Link href="/admin/users" className="tile">
            <div className="tile">
              <strong>사용자 관리</strong>
              <span>역할/권한(추후)</span>
            </div>
          </Link>
        </div>
      </div>

      <style jsx>{styles}</style>
    </section>
  );
}

const styles = `
.wrap {
  max-width: var(--container-max);
  margin: 0 auto;
  padding: 16px;
}
.card {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.06);
}
h1 { margin: 0 0 10px; font-size: 22px; }
.hint { color: #666; margin: 0 0 16px; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 10px;
}

.tile {
  display: grid;
  gap: 6px;
  padding: 14px;
  border: 1px solid #eaeaea;
  border-radius: 10px;
  text-decoration: none;  /* 링크 밑줄 제거 */
  color: inherit;         /* 파란 링크색 방지 */
  background: #fafafa;
  transition: background 0.15s ease;
}
.tile:hover { background: #f2f2f2; }

/* 자식 타이포 */
.tile strong { font-size: 16px; }
.tile span   { font-size: 13px; color: #666; 
`;
