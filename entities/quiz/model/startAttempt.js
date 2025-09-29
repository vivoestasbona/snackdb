import supabaseAdmin from '../../../shared/api/supabaseAdmin.js';

export async function startAttempt(quizId, userId = null) {
  if (!quizId) throw new Error('startAttempt: quizId is required');

  // 퀴즈 존재/공개 여부는 상위 흐름에서 보통 확인하지만,
  // 여기선 존재만 간단히 체크
  const { data: quiz, error: qErr } = await supabaseAdmin
    .from('quizzes')
    .select('id, status, visibility')
    .eq('id', quizId)
    .single();
  if (qErr) throw qErr;

  const { data, error } = await supabaseAdmin
    .from('quiz_attempts')
    .insert({ quiz_id: quizId, user_id: userId })
    .select('id, quiz_id, started_at')
    .single();
  if (error) throw error;

  return data; // { id, quiz_id, started_at }
}
