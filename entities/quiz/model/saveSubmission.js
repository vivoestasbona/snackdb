import supabaseAdmin from '../../../shared/api/supabaseAdmin.js';
import { normalizeAnswerStrict, isExactAnswer } from '../../../shared/lib/normalizeAnswer.js';

export async function saveSubmission({ attemptId, questionId, responseText, timeMs = null }) {
  if (!attemptId || !questionId) throw new Error('saveSubmission: attemptId, questionId required');

  // 1) 시도/문항 일치 확인
  const { data: attempt, error: aErr } = await supabaseAdmin
    .from('quiz_attempts')
    .select('id, quiz_id')
    .eq('id', attemptId)
    .single();
  if (aErr) throw aErr;

  const { data: question, error: qErr } = await supabaseAdmin
    .from('quiz_questions')
    // 정답 컬럼 포함(서버 전용)
    .select('id, quiz_id, response_type, answer_key_text, acceptable_answers')
    .eq('id', questionId)
    .single();
  if (qErr) throw qErr;

  if (question.quiz_id !== attempt.quiz_id) {
    throw new Error('saveSubmission: question does not belong to attempt.quiz');
  }
  if (question.response_type !== 'text') {
    throw new Error('saveSubmission: only text response supported in MVP');
  }

  // 2) 채점(정확 일치)
  const raw = typeof responseText === 'string' ? responseText : '';
  const norm = normalizeAnswerStrict(raw);
  const acceptable = Array.isArray(question.acceptable_answers) ? question.acceptable_answers : [];
  const is_correct = isExactAnswer(raw, question.answer_key_text, acceptable);

  // 3) upsert (attempt_id, question_id 유니크)
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
  if (error) throw error;

  return { submissionId: data.id, is_correct };
}
