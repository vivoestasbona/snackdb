// 권장 구현 예시
import { getSupabaseAdmin } from '../../../shared/api/supabaseAdmin.js';
const supa = getSupabaseAdmin();

export async function getQuestionsPublic(quizId) {
  if (!quizId) throw new Error('quizId required');
  const { data, error } = await supa
    .from('quiz_questions')
    .select('id, order_index, stimulus_image_path, hint_text, response_type')
    .eq('quiz_id', quizId)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
