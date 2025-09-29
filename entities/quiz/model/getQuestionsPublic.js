// entities/quiz/model/getQuestionsPublic.js
import { getSupabaseAdmin } from '../../../shared/api/supabaseAdmin.js';
const supabaseAdmin = getSupabaseAdmin();

/**
 * 특정 퀴즈의 문항 목록을 정답 없이 조회
 * RLS/권한상 공개 컬럼만 선택
 */
export async function getQuestionsPublic(quizId) {
  if (!quizId) throw new Error('getQuestionsPublic: quizId is required');

  const { data, error } = await supabaseAdmin
    .from('quiz_questions')
    .select(`
      id, quiz_id, order_index,
      stimulus_image_path, snack_id,
      hint_text, response_type, points
    `)
    .eq('quiz_id', quizId)                 // ⚠️ 여기 꼭 quizId 사용!
    .order('order_index', { ascending: true });

  if (error) {
    throw new Error(`getQuestionsPublic supabase error: ${error.message}`);
  }
  return data ?? [];
}
