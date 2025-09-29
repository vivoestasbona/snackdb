import { NextResponse } from 'next/server';
import { finishAttempt } from '../../../../entities/quiz/model/finishAttempt.js';

export async function POST(req) {
  try {
    const { attemptId } = await req.json();
    if (!attemptId) {
      return NextResponse.json({ ok: false, error: 'attemptId required' }, { status: 400 });
    }
    const result = await finishAttempt(attemptId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('finish error', e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
