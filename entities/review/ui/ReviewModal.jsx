// entities/review/ui/ReviewModal.jsx
"use client";
import { useState, useEffect } from "react";
import { getSupabaseClient } from "@shared/api/supabaseClient";
import Modal from "@shared/ui/Modal";
import StarField from "@widgets/star-field/ui/StarField";
import { STAT_FIELDS as FIELDS } from "@shared/lib/statLabels";

// 보기 좋은 3줄 placeholder (길이 균형 맞춤)
const PLACEHOLDER =
  "한줄평 (선택, 최대 300자)\n" +
  "점수는 일부만 선택해도 됩니다\n" +
  "모두 비워두면 등록되지 않습니다";
const INITIAL_SCORES = { tasty:null, value:null, plenty:null, clean:null, addictive:null };

export default function ReviewModal({ open, onClose, snackId, onSubmitted }) {
  const sb = getSupabaseClient();
  const [scores, setScores] = useState(INITIAL_SCORES);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  
  //  (A) 방금 "로그아웃" 되었을 때 모달 내부 상태 초기화
  useEffect(() => {
    const { data: sub } = sb.auth.onAuthStateChange((_event, sess) => {
      if (!sess) {
        setScores(INITIAL_SCORES);
        setBody("");
      }
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, [sb]);

  //  (B) 로그아웃 상태에서 모달을 여는 경우에도 즉시 초기화
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await sb.auth.getSession();
      if (!data?.session) {
        setScores(INITIAL_SCORES);
        setBody("");
      }
    })();
  }, [open, sb]);

  const setField = (k, v) => setScores(s => ({ ...s, [k]: v }));

  async function submit(e){
    e.preventDefault();
    if (busy) return;
    setBusy(true);

    const { data: sess } = await sb.auth.getSession();
    const uid = sess?.session?.user?.id;
    if (!uid) { alert("로그인이 필요합니다."); setBusy(false); return; }

    const anyScore = Object.values(scores).some(v => typeof v === "number");
    const hasText  = body.trim().length > 0;

    if (!anyScore && !hasText) {
      alert("점수 항목 중 최소 1개를 선택하거나, 한줄평을 입력해 주세요.");
      setBusy(false);
      return;
    }

    if (anyScore) {
      const up = await sb.from("snack_scores").upsert({ snack_id:snackId, user_id:uid, ...scores });
      if (up.error) { alert("점수 저장 실패: " + up.error.message); setBusy(false); return; }
    }

    if (hasText) {
      const ins = await sb.from("snack_reviews").insert({ snack_id:snackId, user_id:uid, body: body.trim() });
      if (ins.error) { alert("한줄평 저장 실패: " + ins.error.message); setBusy(false); return; }
    }

    setBusy(false);
    onSubmitted?.();
    onClose?.();

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("snack:review-updated", { detail: { snackId } }));
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <form onSubmit={submit} className="wrap">
        <h3 className="title">리뷰 남기기</h3>

        {/* 세로 배치 + 중앙 정렬(StarField 자체도 중앙 정렬) */}
        <div className="fields">
          {FIELDS.map(([k, label])=>(
            <StarField key={k} label={label} value={scores[k]} onChange={(v)=>setField(k, v)} labelWidth={96} />
          ))}
        </div>

        <textarea
          placeholder={PLACEHOLDER}   // ← 3줄 placeholder
          value={body}
          maxLength={300}
          onChange={(e)=>setBody(e.target.value)}
        />

        <div className="actions">
          <button type="submit" disabled={busy}>{busy ? "저장 중…" : "저장"}</button>
          <button type="button" onClick={onClose} disabled={busy}>취소</button>
        </div>
      </form>

      <style jsx>{`
        /* 폼을 모달 내부에서 더 좁게(가운데 정렬) */
        .wrap {
          width: min(440px, 100%);
          margin: 0 auto;
          display: grid;
          gap: 12px;
        }
        .title { text-align: center; margin: 0; }
        .fields {
          display:flex; flex-direction:column; gap:8px;
          align-items:center;
        }
        textarea {
          width:100%;
          min-height:100px;
          padding:10px;
          border:1px solid #ddd;
          border-radius:8px;
          resize:vertical;
          line-height:1.5;
          font-size:14px;
          white-space:pre-wrap;
        }
        .actions { display:flex; gap:8px; justify-content:flex-end; }
        button { padding:8px 12px; border:1px solid #ddd; border-radius:8px; background:#f8f8f8; cursor:pointer; }
      `}</style>
    </Modal>
  );
}
