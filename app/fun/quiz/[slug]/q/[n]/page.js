import { redirect } from 'next/navigation';
import QuizPlayShell from '../../../../../../widgets/quiz/QuizPlayShell.jsx';

export default async function QuizQuestionPage({ params }) {
  const { slug, n } = params ?? {};
  // 더미 3문항 (seed와 동일한 경로로 구성)
  const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const imgs = ['photo-1.jpg', 'photo-2.jpg', 'photo-3.jpg'].map(
    (name) => `${BASE}/storage/v1/object/public/quiz-images/sample/${name}`
  );
  const hints = ['샘플 힌트 #1', '샘플 힌트 #2', '샘플 힌트 #3'];
  const totalQuestions = imgs.length;

  // n 파라미터 검증
  const idx = Number.parseInt(n, 10);
  if (!Number.isFinite(idx) || idx < 1 || idx > totalQuestions) {
    redirect(`/fun/quiz/${slug}`);
  }

  const q = {
    imageSrc: imgs[idx - 1],
    hintText: hints[idx - 1],
  };

  return (
    <main style={{ maxWidth: 720, margin: '32px auto', padding: '0 16px', display: 'grid', gap: 16 }}>
      <QuizPlayShell
        question={q}
        currentIndex={idx}
        totalQuestions={totalQuestions}
      />
    </main>
  );
}
