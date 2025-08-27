// entities/review/model/index.js
import { getSupabaseClient } from "@shared/api/supabase/browser";

/** 세션에서 사용자 ID 가져오기 (클라 전용) */
async function getUserId() {
  const sb = getSupabaseClient();
  const { data } = await sb.auth.getSession();
  return data?.session?.user?.id || null;
}

/** 점수/한줄평 저장 (최소 하나는 있어야 함) */
export async function saveReviewAndScores({ snackId, scores, body }) {
  const sb = getSupabaseClient();
  const uid = await getUserId();
  if (!uid) throw new Error("로그인이 필요합니다.");

  const normScores = Object.fromEntries(
    Object.entries(scores || {}).map(([k, v]) => [k, typeof v === "number" ? v : null])
  );
  const anyScore = Object.values(normScores).some(v => typeof v === "number");
  const text = (body || "").trim();
  const hasText = text.length > 0;

  if (!anyScore && !hasText) {
    throw new Error("점수 항목 중 최소 1개를 선택하거나, 한줄평을 입력해주세요.");
  }

  // 점수 upsert
  if (anyScore) {
    const up = await sb.from("snack_scores").upsert({
      snack_id: snackId,
      user_id: uid,
      ...normScores,
    });
    if (up.error) throw new Error("점수 저장 실패: " + up.error.message);
  }

  // 한줄평 insert
  if (hasText) {
    const ins = await sb.from("snack_reviews").insert({
      snack_id: snackId,
      user_id: uid,
      body: text,
    });
    if (ins.error) throw new Error("한줄평 저장 실패: " + ins.error.message);
  }

  // 브라우저 새로고침 신호
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("snack:review-updated", { detail: { snackId } }));
  }
}

/** 내 리뷰/점수 일괄 삭제 */
export async function deleteMyReviewAndScores({ snackId }) {
  const sb = getSupabaseClient();
  const uid = await getUserId();
  if (!uid) throw new Error("로그인이 필요합니다.");

  const delReviews = sb.from("snack_reviews").delete().eq("snack_id", snackId).eq("user_id", uid);
  const delScores  = sb.from("snack_scores").delete().eq("snack_id", snackId).eq("user_id", uid);
  const [r1, r2] = await Promise.all([delReviews, delScores]);

  if (r1.error || r2.error) {
    throw new Error("삭제 실패: " + (r1.error?.message || r2.error?.message));
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("snack:review-updated", { detail: { snackId } }));
  }
}
