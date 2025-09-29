'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function AnswerFormText({
  slug,
  quizId,
  questionId,
  currentIndex = 1,
  totalQuestions = 1,
}) {
  const [value, setValue] = useState('');
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState(null); // { isCorrect: bool, correctAnswer: string }
  const router = useRouter();

  async function onSubmit(e) {
    e.preventDefault();

    const key = `quiz_attempt_${quizId}`;
    let attemptId = null;
    try { attemptId = localStorage.getItem(key); } catch {}

    const res = await fetch('/api/quiz/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attemptId, quizId, questionId, responseText: value }),
    });

    if (!res.ok) {
      // 에러 내용을 콘솔에 출력 (문자열/JSON 모두 안전 처리)
      let text = '';
      try { text = await res.text(); } catch {}
      console.error('submit failed', text);
      return;
    }

    const json = await res.json();
    if (json.attemptId && json.attemptId !== attemptId) {
      try { localStorage.setItem(key, json.attemptId); } catch {}
      attemptId = json.attemptId;
    }

    // ⬇️ 즉시 피드백 표시(정오 + 정답)
    setFeedback({ isCorrect: !!json.is_correct, correctAnswer: json.correct_answer || '' });
  }

  function goNext() {
    const next = (currentIndex || 1) + 1;

    startTransition(async () => {
      if (next <= (totalQuestions || 0)) {
        router.push(`/fun/quiz/${slug}/q/${next}`);
      } else {
        // 마지막: 완료 처리 → 결과 페이지 이동
        const resFin = await fetch('/api/quiz/finish', {   // ⬅️ finRes 변수명 버그 fix
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attemptId: (() => {
            try { return localStorage.getItem(`quiz_attempt_${quizId}`); } catch { return null; }
          })() }),
        });
        if (resFin.ok) {
          const fin = await resFin.json();
          try { localStorage.removeItem(`quiz_attempt_${quizId}`); } catch {}
          if (fin.ok && fin.slug && fin.share_code) {
            router.push(`/fun/quiz/${fin.slug}/result/${fin.share_code}`);
            return;
          }
        }
        // 실패 시 폴백
        router.push(`/fun/quiz/${slug}`);
      }
    });
  }

  const btnStyle = { padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8 };

  return (
    <div style={{ marginTop: 12 }}>
      {!feedback ? (
        <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
            placeholder="정답을 입력하세요 (정확 일치만 정답)"
            style={{ flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
            required
          />
          <button
            type="submit"
            disabled={pending || !value.trim()}
            style={btnStyle}
          >
            제출
          </button>
        </form>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          <div
            style={{
              padding: 12,
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              background: feedback.isCorrect ? '#ECFDF5' : '#FEF2F2',
              color: feedback.isCorrect ? '#065F46' : '#991B1B',
              fontWeight: 600,
            }}
          >
            {feedback.isCorrect ? '정답!' : '오답!'}{' '}
            {feedback.correctAnswer ? `정답: ${feedback.correctAnswer}` : null}
          </div>
          <div>
            <button type="button" onClick={goNext} style={btnStyle}>
              {currentIndex < totalQuestions ? '다음 문제' : '결과 보기'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
