// app/account/page.js
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@shared/api/supabaseClient";

export default function AccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [pw, setPw] = useState("");
  const [checkingPw, setCheckingPw] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

  useEffect(() => {
    let mounted = true;
    const client = getSupabaseClient();
    if (!client) return;

    async function init() {
      try {
        setLoading(true);
        const { data: s } = await client.auth.getSession();
        const user = s?.session?.user;
        if (!user) {
          router.replace("/");
          return;
        }
        setEmail(user.email || "");

        const { data, error } = await client
          .from("profiles")
          .select("display_name,bio,avatar_url")
          .eq("id", user.id)
          .single();

        if (error) throw error;

        if (!mounted) return;
        setDisplayName(data?.display_name || "");
        setBio(data?.bio || "");
        setAvatarUrl(data?.avatar_url || "");
      } catch (e) {
        if (!mounted) return;
        setError(e.message || "불러오기 오류");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    const { data: sub } = client.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/"); // 로그아웃되면 나가기
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, [router]);

  async function handleSave(e) {
    e?.preventDefault?.();
    setSaving(true);
    setError("");
    try {
      const client = getSupabaseClient();
      const { data: s } = await client.auth.getSession();
      const user = s?.session?.user;
      if (!user) {
        router.replace("/");
        return;
      }

      const { error } = await client
        .from("profiles")
        .update({
          display_name: displayName || null,
          bio: bio || null,
          avatar_url: avatarUrl || null,
        })
        .eq("id", user.id);

      if (error) throw error;
    } catch (e) {
      setError(e.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
  setDeleting(true);
  setDeleteErr("");
  try {
    const client = getSupabaseClient();

    // 1) 비밀번호 재확인 (reauth)
    setCheckingPw(true);
    const { error: pwErr, data: signData } = await client.auth.signInWithPassword({
      email,
      password: pw,
    });
    setCheckingPw(false);
    if (pwErr) {
      throw new Error("비밀번호가 올바르지 않습니다.");
    }

    // 2) 최신 세션 토큰 확보 (재인증 결과 우선)
    const newToken =
      signData?.session?.access_token ??
      (await client.auth.getSession()).data?.session?.access_token;
    if (!newToken) throw new Error("세션을 확인할 수 없습니다.");

    // 3) 서버에 삭제 요청
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${newToken}`,
      },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      throw new Error(json?.error || "삭제 실패");
    }

    // 4) 클라이언트 세션 정리 및 홈으로
    await client.auth.signOut();
    router.replace("/");
  } catch (e) {
    setDeleteErr(e.message || "삭제 실패");
  } finally {
    setDeleting(false);
  }
}

  if (loading) {
    return (
      <section className="wrap">
        <div className="card">
          <h1>내 정보</h1>
          <p>불러오는 중…</p>
        </div>
        <style jsx>{styles}</style>
      </section>
    );
  }

  return (
    <section className="wrap">
      <div className="card">
        <h1>내 정보</h1>
        <form onSubmit={handleSave} className="form">
          <label>
            이메일 (읽기 전용)
            <input type="email" value={email} disabled />
          </label>

          <label>
            표시 이름
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="예: 태웅쌤"
              maxLength={60}
            />
          </label>

          <label>
            소개
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="간단한 자기소개를 적어주세요"
              rows={5}
            />
          </label>

          <label>
            아바타 URL (선택)
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.png"
            />
          </label>

          <div className="row">
            <button type="submit" disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </button>
            {error && <span className="err">{error}</span>}
          </div>
        </form>

        <hr style={{margin:"20px 0"}} />
        <div className="danger">
          <h2>회원 탈퇴</h2>
          <p>탈퇴 시 계정과 프로필 정보가 삭제됩니다. 되돌릴 수 없습니다.</p>
          <button className="dangerBtn" onClick={() => setShowDelete(true)}>회원 탈퇴</button>
        </div>
       </div>

      {showDelete && (
        <div className="overlay" onClick={() => setShowDelete(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()}>
            <h3>정말 탈퇴하시겠어요?</h3>
            <p style={{marginBottom:8}}>
              보안을 위해 <b>비밀번호를 다시 입력</b>해 주세요.
            </p>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="비밀번호"
            />
            {deleteErr && <p className="err" style={{marginTop:8}}>{deleteErr}</p>}
            <div className="row">
              <button onClick={() => setShowDelete(false)}>취소</button>
              <button
                className="dangerBtn"
                disabled={deleting || checkingPw || !pw}
                onClick={handleDelete}
              >
                {deleting ? "삭제 중..." : checkingPw ? "확인 중..." : "영구 삭제"}
               </button>
            </div>
          </div>
        </div>
      )}

       <style jsx>{styles}</style>
    </section>
  );
}

const styles = `
.wrap { max-width: 980px; margin: 0 auto; padding: 16px; }
.card { background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 20px; box-shadow: 0 6px 18px rgba(0,0,0,0.06); }
h1 { margin: 0 0 12px; font-size: 22px; }
.form { display: grid; gap: 12px; }
label { display: grid; gap: 6px; font-size: 14px; }
input[type="email"],
input[type="text"],
input[type="url"],
textarea {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
}
textarea { resize: vertical; }
.row { display: flex; gap: 10px; align-items: center; }
button {
  padding: 10px 14px;
  border: none;
  border-radius: 8px;
  background: #222;
  color: #fff;
  cursor: pointer;
}
.err { color: #c00; font-size: 13px; }
.danger { margin-top: 10px; }
.dangerBtn { background: #fff0f0; border: 1px solid #f2c2c2; color: #b00020; }
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45);
  display: grid; place-items: center; z-index: 1000;
}
.panel {
  width: min(92vw, 420px); background: #fff; border-radius: 12px;
  padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  display: grid; gap: 10px;
}
 `;
