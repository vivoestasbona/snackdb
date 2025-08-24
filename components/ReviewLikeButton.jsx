// components/ReviewLikeButton.jsx
"use client";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { promptLogin } from "@/lib/loginPrompt";

export default function ReviewLikeButton({ 
  reviewId, 
  snackId, 
  initialCount=0, 
  initialLiked=false, 
  disabled=false 
}) {
  
  const sb = getSupabaseClient();
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);

  useEffect(() => {
    setCount(initialCount);
    setLiked(initialLiked);
  }, [initialCount, initialLiked]);

  //  로그아웃되면 즉시 liked 표시만 해제
  useEffect(() => {
    const { data: sub } = sb.auth.onAuthStateChange((_e, sess) => {
      if (!sess) setLiked(false);
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, [sb]);

  async function toggle() {
    if (disabled) return;
    const { data: sess } = await sb.auth.getSession();
    const uid = sess?.session?.user?.id;
    if (!uid) {
      promptLogin({ reason: "좋아요를 누르려면 로그인해주세요", from: "review:like", reviewId, snackId });
      return;
    }

    if (liked) {
      const { error } = await sb
        .from("snack_review_likes")
        .delete()
        .eq("review_id", reviewId)
        .eq("user_id", uid);
      if (!error) { setLiked(false); setCount((c)=>Math.max(0,c-1)); }
    } else {
      const { error } = await sb
        .from("snack_review_likes")
        .insert({ review_id: reviewId, user_id: uid });
      if (!error) { setLiked(true); setCount((c)=>c+1); }
    }
  }

  return (
    <button
      className={`rv-like ${liked ? "on" : ""}`}
      aria-pressed={liked}
      onClick={toggle}
      disabled={disabled}
      title={disabled ? "내 한줄평에는 좋아요를 누를 수 없습니다" : "좋아요"}
    >
      <span className="icon" aria-hidden>♥</span>
      <span className="num">{count}</span>

      <style jsx>{`
        .rv-like {
          display:inline-flex; align-items:center; gap:6px;
          padding:6px 10px; border:1px solid #ddd; border-radius:999px;
          background:#fff; cursor:pointer; font-size:13px;
        }
        .rv-like.on { border-color:#f88; background:#fff1f3; }
        .rv-like:disabled { opacity:.6; cursor:default; }
        .icon { line-height:1; }
        .num { min-width:1em; text-align:right; }
      `}</style>
    </button>
  );
}
