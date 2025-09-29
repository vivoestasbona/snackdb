// entities/quiz/model/saveSubmission.js
import { getSupabaseAdmin } from '../../../shared/api/supabaseAdmin.js';
import { normalizeAnswerStrict, isExactAnswer } from '../../../shared/lib/normalizeAnswer.js';
const supabaseAdmin = getSupabaseAdmin();

export async function saveSubmission({ attemptId, questionId, responseText, timeMs = null }) {
  if (!attemptId || !questionId) throw new Error('saveSubmission: attemptId, questionId required');

  // attempt ↔ quiz_id
  const { data: attempt, error: aErr } = await supabaseAdmin
    .from('quiz_attempts')
    .select('id, quiz_id')
    .eq('id', attemptId)
    .single();
  if (aErr) throw new Error(`saveSubmission attempt error: ${aErr.message}`);

  // question + answers (서버 전용)
  const { data: question, error: qErr } = await supabaseAdmin
    .from('quiz_questions')
    .select('id, quiz_id, response_type, answer_key_text, acceptable_answers')
    .eq('id', questionId)
    .single();
  if (qErr) throw new Error(`saveSubmission question error: ${qErr.message}`);

  if (question.quiz_id !== attempt.quiz_id) {
    throw new Error('saveSubmission: question does not belong to attempt.quiz');
  }
  if (question.response_type !== 'text') {
    throw new Error('saveSubmission: only text response supported in MVP');
  }

  // 채점(정확 일치)
  const raw = typeof responseText === 'string' ? responseText : '';
  const norm = normalizeAnswerStrict(raw);
  const acceptable = Array.isArray(question.acceptable_answers) ? question.acceptable_answers : [];
  const is_correct = isExactAnswer(raw, question.answer_key_text, acceptable);

  // upsert (attempt_id, question_id 유니크)
  const upsertRow = {
    attempt_id: attemptId,
    question_id: questionId,
    response_text_raw: raw,
    response_text_norm: norm,
    is_correct,
    answered_at: new Date().toISOString(),
    time_ms: typeof timeMs === 'number' ? Math.max(0, Math.floor(timeMs)) : null,
  };

  const { data, error } = await supabaseAdmin
    .from('quiz_submissions')
    .upsert(upsertRow, { onConflict: 'attempt_id,question_id' })
    .select('id, is_correct')
    .single();
  if (error) throw new Error(`saveSubmission upsert error: ${error.message}`);

  // ⬇️ 클라이언트 피드백용으로 "정답"도 반환
  return {
    submissionId: data.id,
    is_correct,
    correct_answer: question.answer_key_text,
  };
}
