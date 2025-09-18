// features/like-snack/ui/LikeButton.jsx

"use client";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@shared/api/supabaseClient";
import { promptLogin } from "@entities/user/model/loginPrompt";

export default function LikeButton({ snackId }) {
  const sb = getSupabaseClient();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(()=>{ let on=true;(async()=>{
    const { data: sess } = await sb.auth.getSession();
    const uid = sess?.session?.user?.id;

    const { count: c } = await sb.from("snack_likes")
      .select("snack_id", { count:"exact", head:true })
      .eq("snack_id", snackId);
    if (on) setCount(c||0);

    if (uid) {
      const { data: mine } = await sb.from("snack_likes")
        .select("snack_id").eq("snack_id",snackId).eq("user_id",uid).maybeSingle();
      if (on) setLiked(!!mine);
    }
  })(); return ()=>{on=false}; },[snackId]);

  //  로그아웃되면 즉시 표시만 해제 (클릭은 여전히 가능)
  useEffect(() => {
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (!session) setLiked(false);
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, [sb]);

  async function toggle() {
    const { data: sess } = await sb.auth.getSession();
    const uid = sess?.session?.user?.id;
    if (!uid) {
      promptLogin({ reason: "좋아요를 누르려면 로그인해주세요", from: "snack:like", snackId });
      return;
    }

    if (liked) {
      const { error } = await sb.from("snack_likes")
        .delete().eq("snack_id",snackId).eq("user_id",uid);
      if (!error) { setLiked(false); setCount(c=>Math.max(0,c-1)); }
    } else {
      const { error } = await sb.from("snack_likes")
        .insert({ snack_id:snackId, user_id:uid });
      if (!error) { setLiked(true); setCount(c=>c+1); }
    }
  }

  return (
    <button
      type="button"
      className={`like ${liked ? "on" : ""}`}
      onClick={(e) => { e.stopPropagation(); toggle(); }}  // 링크로 전파 방지
      aria-pressed={liked}
      aria-label={`좋아요 ${count}개`}
    >
      <span className="icon" aria-hidden>♡</span>
      <span className="count">{count}</span>
      <style jsx>{`
        .like {
          /* 버튼 리셋 */
          background: transparent;
          border: 0;
          padding: 0;
          margin: 0;
          font: inherit;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        }
        .icon { font-size: 16px; }
        .like.on .icon { color: #e55; }
        .like:not(.on):hover .icon { color: #e55; }
        .count { font-weight: 600; }
      `}</style>
    </button>
  );
}
