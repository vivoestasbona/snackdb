// entities/review/ui/ReviewForm.jsx
"use client";
import { useState } from "react";
import { getSupabaseClient } from "@shared/api/supabaseClient";
import { STAT_FIELDS as FIELDS } from "@shared/lib/statLabels";

export default function ReviewForm({ snackId }) {
  const sb = getSupabaseClient();
  // 기본값은 전부 null (미선택)
  const [scores, setScores] = useState({ tasty:null, value:null, plenty:null, clean:null, addictive:null });
  const [body, setBody]   = useState("");
  const [busy, setBusy]   = useState(false);

  const changeScore = (k, val) => setScores(s => ({ ...s, [k]: val === "" ? null : Number(val) }));

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
      alert("점수 항목 중 최소 1개를 선택하거나, 한줄평을 입력해주세요.");
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

    // 폼 리셋
    setScores({ tasty:null, value:null, plenty:null, clean:null, addictive:null });
    setBody("");
    setBusy(false);

    // 갱신 이벤트(레이더/한줄평 새로고침)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("snack:review-updated", { detail: { snackId } }));
    }
  }

  async function removeMine(){
    if (busy) return;
    const ok = confirm("내 점수와 한줄평을 모두 삭제할까요? (되돌릴 수 없음)");
    if (!ok) return;
    setBusy(true);

    const { data: sess } = await sb.auth.getSession();
    const uid = sess?.session?.user?.id;
    if (!uid) { alert("로그인이 필요합니다."); setBusy(false); return; }

    const delReviews = sb.from("snack_reviews").delete().eq("snack_id", snackId).eq("user_id", uid);
    const delScores  = sb.from("snack_scores").delete().eq("snack_id", snackId).eq("user_id", uid);
    const [r1, r2] = await Promise.all([delReviews, delScores]);
    if (r1.error || r2.error) {
      alert("삭제 실패: " + (r1.error?.message || r2.error?.message));
      setBusy(false); return;
    }

    setScores({ tasty:null, value:null, plenty:null, clean:null, addictive:null });
    setBody("");
    setBusy(false);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("snack:review-updated", { detail: { snackId } }));
    }
  }

  return (
    <form className="review" onSubmit={submit}>
      <h3>리뷰 남기기</h3>

      {/* 점수 선택: 1줄, 라벨+셀렉트 결합(placeholder로 항목명 표기) */}
      <div className="scores" role="group" aria-label="스코어 선택">
        {FIELDS.map(([k,label])=>(
          <select
            key={k}
            className="score"
            value={scores[k] ?? ""}
            onChange={e=>changeScore(k, e.target.value)}
            aria-label={`${label} 점수`}
          >
            {/* 빈 값(미선택) → 라벨을 placeholder처럼 사용 */}
            <option value="">{label}</option>
            {[1,2,3,4,5].map(v=>(
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        ))}
      </div>

      <textarea
        placeholder="한줄평 (선택, 최대 300자). 점수 항목 중 1개 이상 또는 한줄평만으로도 등록 가능합니다."
        value={body}
        maxLength={300}
        onChange={e=>setBody(e.target.value)}
      />

      <div className="actions">
        <button type="submit" disabled={busy}>{busy ? "저장 중…" : "저장"}</button>
        <button type="button" className="danger" onClick={removeMine} disabled={busy}>내 리뷰/점수 삭제</button>
      </div>

      {/* styled-jsx는 클라이언트 컴포넌트에서 사용 가능 */}
      <style jsx>{`
        .review { margin-top:16px; display:grid; gap:10px; }
        .scores {
          display:flex;
          gap:8px;
          flex-wrap:nowrap;    /* 한 줄 고정 */
          overflow-x:auto;     /* 작은 화면에서는 가로 스크롤 */
          padding-bottom:2px;  /* 스크롤바 여유 */
        }
        .score {
          min-width: 120px;    /* 5개가 한 줄에 나란히 */
          padding: 8px 10px;
          border:1px solid #ddd;
          border-radius:8px;
          background:#fff;
        }
        textarea {
          width:100%;
          min-height:90px;
          padding:10px;
          border:1px solid #ddd;
          border-radius:8px;
          resize:vertical;
        }
        .actions { display:flex; gap:8px; }
        button { padding:8px 12px; border:1px solid #ddd; border-radius:8px; background:#f8f8f8; cursor:pointer; }
        .danger { border-color:#f1b0b7; background:#fff5f5; color:#b00020; }
      `}</style>
    </form>
  );
}
