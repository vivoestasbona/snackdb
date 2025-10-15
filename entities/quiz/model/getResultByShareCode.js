import { getSupabaseAdmin } from '../../../shared/api/supabaseAdmin.js';
const supabaseAdmin = getSupabaseAdmin();

export async function getResultByShareCode(shareCode) {
  if (!shareCode) throw new Error('getResultByShareCode: shareCode is required');

  // attempt ← share_code
  const { data: attempt, error: aErr } = await supabaseAdmin
    .from('quiz_attempts')
    .select('id, quiz_id, total_correct, total_questions, finished_at, share_code')
    .eq('share_code', shareCode)
    .single();
  if (aErr) throw aErr;

  // quiz 메타 동봉(공개/비공개 무관 — 결과 열람은 share_code로 제한될 예정)
  const { data: quiz, error: qErr } = await supabaseAdmin
    .from('quizzes')
    .select('slug, title, visibility, status')
    .eq('id', attempt.quiz_id)
    .single();
  if (qErr) throw qErr;

  return {
    attemptId: attempt.id,
    slug: quiz.slug,
    title: quiz.title,
    total_correct: attempt.total_correct ?? 0,
    total_questions: attempt.total_questions ?? 0,
    finished_at: attempt.finished_at,
    share_code: attempt.share_code,
  };
}
