import { getSupabaseAdmin } from '../../../shared/api/supabaseAdmin.js';
const supabaseAdmin = getSupabaseAdmin();

function genShareCode(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 0/O,1/I 제외
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function finishAttempt(attemptId) {
  if (!attemptId) throw new Error('finishAttempt: attemptId is required');

  // 1) attempt → quiz_id
  const { data: attempt, error: aErr } = await supabaseAdmin
    .from('quiz_attempts')
    .select('id, quiz_id, share_code, finished_at')
    .eq('id', attemptId)
    .single();
  if (aErr) throw aErr;

  // 2) totals
  const [{ count: total_questions }, { count: total_correct }] = await Promise.all([
    supabaseAdmin.from('quiz_questions').select('*', { count: 'exact', head: true }).eq('quiz_id', attempt.quiz_id),
    supabaseAdmin
      .from('quiz_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('attempt_id', attemptId)
      .eq('is_correct', true),
  ]);

  // 3) share_code 보장(없으면 생성)
  let share_code = attempt.share_code;
  if (!share_code) {
    // 충돌 드물지만 3회 재시도
    for (let i = 0; i < 3; i++) {
      const candidate = genShareCode(8);
      const { data: exists, error: eErr } = await supabaseAdmin
        .from('quiz_attempts')
        .select('id')
        .eq('share_code', candidate)
        .maybeSingle();
      if (eErr) throw eErr;
      if (!exists) { share_code = candidate; break; }
    }
    if (!share_code) share_code = genShareCode(10);
  }

  // 4) update attempt
  const { data: updated, error: uErr } = await supabaseAdmin
    .from('quiz_attempts')
    .update({
      finished_at: new Date().toISOString(),
      total_questions: total_questions ?? 0,
      total_correct: total_correct ?? 0,
      share_code,
    })
    .eq('id', attemptId)
    .select('id, quiz_id, total_correct, total_questions, share_code, finished_at')
    .single();
  if (uErr) throw uErr;

  // 5) 결과 + 퀴즈 메타(슬러그/타이틀) 동봉
  const { data: quiz, error: qErr } = await supabaseAdmin
    .from('quizzes')
    .select('slug, title')
    .eq('id', updated.quiz_id)
    .single();
  if (qErr) throw qErr;

  return {
    attemptId: updated.id,
    quizId: updated.quiz_id,
    slug: quiz.slug,
    title: quiz.title,
    total_correct: updated.total_correct,
    total_questions: updated.total_questions,
    share_code: updated.share_code,
    finished_at: updated.finished_at,
  };
}
