import supabaseAdmin from '../../../shared/api/supabaseAdmin.js';

export async function getQuestionsPublic(quizId) {
  if (!quizId) throw new Error('getQuestionsPublic: quizId is required');

  // 정답 컬럼은 절대 select하지 않음(관리자라도).
  const { data, error } = await supabaseAdmin
    .from('quiz_questions')
    .select(
      id, quiz_id, order_index,
      stimulus_image_path, snack_id,
      hint_text, response_type, points
    )
    .eq('quiz_id', quizId)
    .order('order_index', { ascending: true });

  if (error) throw error;
  return data; // [{ id, order_index, stimulus_image_path, ... }, ...]
}
