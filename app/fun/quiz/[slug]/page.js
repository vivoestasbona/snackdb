import { redirect, notFound } from 'next/navigation';
import QuizPlayShell from '../../../../../../widgets/quiz/QuizPlayShell.jsx';
import { getQuizPublicBySlug } from '../../../../../../entities/quiz/model/getQuizPublicBySlug.js';
import { getQuestionsPublic } from '../../../../../../entities/quiz/model/getQuestionsPublic.js';

// storage 경로(예: "quiz-images/sample/photo-1.jpg") → 공개 URL
function toPublicUrl(storagePath) {
  if (!storagePath) return '';
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL; // e.g. https://xxx.supabase.co
  return `${base}/storage/v1/object/public/${storagePath}`;
}

export default async function QuizQuestionPage({ params }) {
  // Next 15: params는 Promise → await 필요
  const { slug, n } = (await params) ?? {};
  if (!slug) notFound();

  // 1) 퀴즈 메타(공개 상태만)
  const meta = await getQuizPublicBySlug(slug).catch(() => null);
  if (!meta) notFound();

  // 2) 문항 목록(정답 제외)
  const questions = await getQuestionsPublic(meta.id);
  const totalQuestions = Array.isArray(questions) ? questions.length : 0;

  // n 검증
  const idx = Number.parseInt(n, 10);
  if (!Number.isFinite(idx) || idx < 1 || idx > totalQuestions) {
    redirect(`/fun/quiz/${slug}`); // 범위 밖이면 시작 화면으로
  }

  // order_index 1-based
  const current = questions.find(q => q.order_index === idx) ?? questions[idx - 1];
  if (!current) redirect(`/fun/quiz/${slug}`);

  const q = {
    imageSrc: toPublicUrl(current.stimulus_image_path),
    hintText: current.hint_text ?? '',
  };

  return (
    <main style={{ maxWidth: 720, margin: '32px auto', padding: '0 16px', display: 'grid', gap: 16 }}>
      <QuizPlayShell
        question={q}
        currentIndex={idx}
        totalQuestions={totalQuestions}
        // answerForm는 다음 단계에서 연결
      />
    </main>
  );
}
