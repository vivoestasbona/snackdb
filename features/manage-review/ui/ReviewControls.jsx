// components/ReviewControls.jsx
"use client";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@shared/api/supabaseClient";
import ReviewModal from "@entities/review/ui/ReviewModal";
import { promptLogin } from "@entities/user/model/loginPrompt";

export default function ReviewControls({ snackId }) {
  const sb = getSupabaseClient();
  const [hasMine, setHasMine] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function openReview() {
   const { data } = await sb.auth.getSession();
   if (!data?.session) {
        alert("로그인이 필요합니다.");   // ← 나중에 로그인 모달 붙일 때 여기만 교체
        return;
      }
      setOpen(true);
    }

  async function refresh() {
    const { data: sess } = await sb.auth.getSession();
    const uid = sess?.session?.user?.id;
    if (!uid) { setHasMine(false); return; }
    const [{ count: c1 }, { count: c2 }] = await Promise.all([
      sb.from("snack_scores")
        .select("snack_id", { count: "exact", head: true })
        .eq("snack_id", snackId).eq("user_id", uid),
      sb.from("snack_reviews")
        .select("id", { count: "exact", head: true })
        .eq("snack_id", snackId).eq("user_id", uid),
    ]);
    setHasMine(((c1 || 0) + (c2 || 0)) > 0);
  }

  useEffect(() => {
    refresh();
    const handler = (e) => { if (e.detail?.snackId === snackId) refresh(); };
    window.addEventListener("snack:review-updated", handler);
    //  로그아웃/로그인도 즉시 반영
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        // 방금 로그아웃됨 → 표시만 바로 바꾸고, 서버 확인은 다음 렌더에서
        setHasMine(false);
      } else {
        // 로그인됨 → 내 리뷰/점수 존재 여부를 다시 확인
        refresh();
      }
    });
    return () => {
      window.removeEventListener("snack:review-updated", handler);
      sub?.subscription?.unsubscribe?.();
    };
 }, [snackId]);

  async function removeMine() {
    if (busy) return;
    const ok = confirm("내 점수와 한줄평을 모두 삭제할까요? (되돌릴 수 없음)");
    if (!ok) return;
    setBusy(true);

    const { data: sess } = await sb.auth.getSession();
    const uid = sess?.session?.user?.id;
    if (!uid) { alert("로그인이 필요합니다."); setBusy(false); return; }

    // ① 낙관적 토글: UI를 먼저 바꿔줌
    setHasMine(false);

    const [r1, r2] = await Promise.all([
        sb.from("snack_reviews").delete().eq("snack_id", snackId).eq("user_id", uid),
        sb.from("snack_scores").delete().eq("snack_id", snackId).eq("user_id", uid),
    ]);

    if (r1.error || r2.error) {
      alert("삭제 실패: " + (r1.error?.message || r2.error?.message));
      // 실패 시 되돌림
      await refresh();
      setBusy(false);
      return;
    }

    // 삭제 후 재확인(잔존시 원인 안내)
    const [{ count: c1 }, { count: c2 }] = await Promise.all([
        sb.from("snack_scores").select("snack_id", { count:"exact", head:true })
            .eq("snack_id", snackId).eq("user_id", uid),
        sb.from("snack_reviews").select("id", { count:"exact", head:true })
            .eq("snack_id", snackId).eq("user_id", uid),
    ]);
    if ((c1||0) + (c2||0) > 0) {
        alert("일부 항목이 삭제되지 않았습니다. (권한/RLS 확인 필요)");
    }
  

    // ② DB 기준으로 재확인(확정)
    await refresh();
    setBusy(false);

    // 레이더/한줄평 갱신
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("snack:review-updated", { detail: { snackId } }));
    }
  }

  async function openReview() {
    const { data } = await sb.auth.getSession();
    if (!data?.session) {
      // ⬇ 기존 alert 대신 모달
      promptLogin({ reason: "리뷰를 남기려면 로그인해주세요", from: "review:button", snackId });
      return;
    }
    setOpen(true);
  }

  return (
     <>
      {hasMine ? (
        <button className="danger" onClick={removeMine} disabled={busy}>
          내 리뷰/점수 삭제
        </button>
      ) : (
        <button onClick={openReview}>리뷰 남기기</button>
      )}

      <ReviewModal
        open={open}
        onClose={()=>setOpen(false)}
        snackId={snackId}
        // ③ 작성 완료 시에도 DB 기준으로 재확인
        onSubmitted={() => { setOpen(false); refresh(); }}
      />

      <style jsx>{`
        .primary, .danger {
          padding:8px 12px; border:1px solid #ddd; border-radius:8px; background:#f8f8f8; cursor:pointer;
        }
        .danger { border-color:#f1b0b7; background:#fff5f5; color:#b00020; }
      `}</style>
    </>
  );
}
