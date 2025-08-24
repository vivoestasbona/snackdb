// components/LoginModal.jsx
"use client";
import { useState, useEffect, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

export default function LoginModal({ open, onClose, reason }) {
  const startedOnOverlay = useRef(false);
  const [mode, setMode] = useState("signin"); // 'signin' | 'signup'
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [nick, setNick] = useState("");          // 닉네임
  const [nickOK, setNickOK] = useState(null);    // true/false/null(미확인)
  const [nickMsg, setNickMsg] = useState("");

  const [remember, setRemember] = useState(true); // 로그인 상태 유지
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

   // 닉네임 가용성 검사 (blur 또는 버튼으로도 가능; 여기서는 onChange 후 짧게 디바운스)
  useEffect(() => {
     if (mode !== "signup") return;
     const name = nick.trim();
     setNickOK(null);
     setNickMsg("");
     if (!name) return;
     const t = setTimeout(async () => {
       try {
         const client = getSupabaseClient(); // anon로도 RPC 호출 가능(SECURITY DEFINER)
         const { data, error } = await client.rpc("is_display_name_available", { p_name: name });
         if (error) throw error;
         setNickOK(!!data);
         setNickMsg(data ? "사용 가능합니다." : "이미 사용 중입니다.");
       } catch (e) {
         setNickOK(null);
         setNickMsg("가용성 확인 실패");
       }
     }, 400);
     return () => clearTimeout(t);
   }, [nick, mode]);

    // Esc 키로 닫기
    useEffect(() => {
      if (!open) return;
      const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      // 선택한 remember에 맞춰 클라이언트를 만든다
      const supabase = getSupabaseClient({ remember });
      if (!supabase) throw new Error("Supabase 초기화 실패");

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: pw,
        });
        if (error) throw error;

        // 사용자의 remember 선택을 기록 (앱 전역 동기화용)
        window.localStorage.setItem("snackdb_remember", remember ? "1" : "0");

        // 모달 닫고 전역 클라이언트를 같은 모드로 재초기화하기 위해 새로고침(MVP)
        onClose?.();
        window.location.reload();
      } else {
        // 회원가입: 닉네임 필수 + 가용성 확인
        const name = nick.trim();
        if (!name) throw new Error("닉네임을 입력하세요.");
        if (nickOK === false) throw new Error("이미 사용 중인 닉네임입니다.");

        // user meta에 닉네임을 실어 보냄 → 트리거가 profiles.display_name에 복사
        const { data, error } = await supabase.auth.signUp({
          email,
          password: pw,
          options: { data: { display_name: name } },
        });
        if (error) throw error;
        setMsg(
          data?.user
            ? "회원가입 완료! 이제 로그인해 주세요."
            : "확인 메일을 보냈어요. 메일함을 확인해 주세요."
        );
        setMode("signin");
      }
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
   <>
     {open && (
        <div
          className="overlay"
          onPointerDown={(e) => {
             // overlay에서 눌렀는지 기록
            startedOnOverlay.current = e.target === e.currentTarget;
          }}
          onPointerUp={(e) => {
            // overlay에서 눌렀고, overlay에서 뗐을 때만 닫기
            if (startedOnOverlay.current && e.target === e.currentTarget) {
              onClose?.();
            }
            startedOnOverlay.current = false;
          }}
        >

      <div className="panel" role="dialog" aria-modal="true">
        <h2>{mode === "signin" ? "로그인" : "회원가입"}</h2>
        {!!reason && <p className="reason">{reason}</p>}
        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label>
              닉네임 (필수)
              <input
                type="text"
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                required
                minLength={2}
                maxLength={20}
                placeholder="예: 건조한 초코칩"
              />
              {!!nick && (
                <small style={{color: nickOK ? "#008000" : "#c00"}}>
                  {nickMsg}
                </small>
              )}
            </label>
          )}

          <label>
            이메일
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
              minLength={6}
            />
          </label>

          {mode === "signin" && (
            <label className="remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              로그인 상태 유지
            </label>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "처리 중..." : mode === "signin" ? "로그인" : "회원가입"}
          </button>
        </form>

        <div className="switch">
          {mode === "signin" ? (
            <>
              <span>처음이신가요?</span>
              <button onClick={() => setMode("signup")} className="linklike">
                회원가입
              </button>
            </>
          ) : (
            <>
              <span>이미 계정이 있나요?</span>
              <button onClick={() => setMode("signin")} className="linklike">
                로그인으로 돌아가기
              </button>
            </>
          )}
        </div>

        {!!msg && <p className="msg">{msg}</p>}
        <button className="close" onClick={onClose}>
          닫기
        </button>
      </div>

      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
          display: grid;
          place-items: center;
          z-index: 1000;
          touch-action: none; /* 모바일에서 터치 제스처로 인한 의도치 않은 상호작용 방지 */
        }
        .panel {
          width: min(92vw, 420px);
          background: #fff;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        }
        .reason { margin: 4px 0 10px; color:#555; font-size:14px; }
        h2 {
          margin: 0 0 12px;
          font-size: 20px;
        }
        form {
          display: grid;
          gap: 10px;
        }
        label {
          display: grid;
          gap: 6px;
          font-size: 14px;
        }
        input[type="email"],
        input[type="password"] {
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
        }
        .remember {
          display: flex;
          align-items: center;
          gap: 8px;
          user-select: none;
        }
        button[type="submit"] {
          margin-top: 6px;
          padding: 10px 12px;
          border: none;
          border-radius: 8px;
          background: #222;
          color: #fff;
          cursor: pointer;
        }
        .switch {
          margin-top: 10px;
          display: flex;
          gap: 8px;
          align-items: center;
          font-size: 14px;
        }
        .linklike {
          background: none;
          border: none;
          color: #0063e5;
          cursor: pointer;
          padding: 0;
        }
        .msg {
          margin-top: 10px;
          font-size: 13px;
          color: #444;
        }
        .close {
          margin-top: 10px;
          background: #f3f3f3;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          padding: 8px 10px;
          cursor: pointer;
        }
      `}</style>


       </div>
     )}
   </>
  );
}
