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
      console.error('submit failed', await res.text());
      return;
    }

    const json = await res.json();
    if (json.attemptId && json.attemptId !== attemptId) {
      try { localStorage.setItem(key, json.attemptId); } catch {}
      attemptId = json.attemptId;
    }

    const next = (currentIndex || 1) + 1;

    startTransition(async () => {
      if (next <= (totalQuestions || 0)) {
        router.push(`/fun/quiz/${slug}/q/${next}`);
      } else {
        // 마지막: 완료 처리
        await fetch('/api/quiz/finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attemptId }),
        });
        router.push(`/fun/quiz/${slug}`);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
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
        style={{ padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8 }}
      >
        제출
      </button>
    </form>
  );
}

// (선택) named export도 함께 노출하면 import 실수 방지에 도움됨
export { AnswerFormText as NamedAnswerFormText };
