// entities/quiz/model/startAttempt.js
import { getSupabaseAdmin } from '../../../shared/api/supabaseAdmin.js';
const supabaseAdmin = getSupabaseAdmin();

export async function startAttempt(quizId, userId = null) {
  if (!quizId) throw new Error('startAttempt: quizId is required');

  // 간결하게: 존재 체크는 생략(이미 공개 퀴즈 상태에서만 호출됨)
  const { data, error } = await supabaseAdmin
    .from('quiz_attempts')
    .insert({ quiz_id: quizId, user_id: userId })
    .select('id, quiz_id, started_at')
    .single();

  if (error) throw new Error(`startAttempt supabase error: ${error.message}`);
  return data; // { id, quiz_id, started_at }
}
