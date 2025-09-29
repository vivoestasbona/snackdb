import { NextResponse } from 'next/server';
import { startAttempt } from '../../../../entities/quiz/model/startAttempt.js';
import { saveSubmission } from '../../../../entities/quiz/model/saveSubmission.js';

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { attemptId: attemptIn, quizId, questionId, responseText } = body;

    if (!quizId || !questionId) {
      return NextResponse.json({ ok: false, error: 'quizId and questionId required' }, { status: 400 });
    }

    let attemptId = attemptIn;
    if (!attemptId) {
      const started = await startAttempt(quizId, null);
      attemptId = started.id;
    }

    const saved = await saveSubmission({ attemptId, questionId, responseText });

    return NextResponse.json({
      ok: true,
      attemptId,
      is_correct: !!saved.is_correct,
      correct_answer: saved.correct_answer,   // ⬅️ 정답 포함
    });
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    console.error('[submit] error:', e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
