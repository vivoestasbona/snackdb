import { redirect, notFound } from 'next/navigation';
import QuizPlayShell from '../../../../../../widgets/quiz/QuizPlayShell.jsx';
import { getQuizPublicBySlug } from '../../../../../../entities/quiz/model/getQuizPublicBySlug.js';
import { getQuestionsPublic } from '../../../../../../entities/quiz/model/getQuestionsPublic.js';
import AnswerFormText from '../../../../../../features/quiz-play/ui/AnswerFormText.jsx';

function toPublicUrl(storagePath) {
  if (!storagePath) return '';
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${storagePath}`;
}

export default async function QuizQuestionPage({ params }) {
  const { slug, n } = (await params) ?? {};          
  if (!slug) notFound();

  // getQuizPublicBySlug는 { data, redirect_to } 형태를 반환합니다.
  const { data: meta, redirect_to } = await getQuizPublicBySlug(slug).catch(() => ({}));
  if (redirect_to) redirect(redirect_to);
  if (!meta) notFound();

  const questions = await getQuestionsPublic(meta.id);
  const totalQuestions = Array.isArray(questions) ? questions.length : 0;

  const idx = Number.parseInt(n, 10);
  if (!Number.isFinite(idx) || idx < 1 || idx > totalQuestions) {
    redirect(`/fun/quiz/${slug}`);
  }

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
        answerForm={
          <AnswerFormText
            slug={slug}
            quizId={meta.id}
            questionId={current.id}
            currentIndex={idx}
            totalQuestions={totalQuestions}
          />
        }
      />
    </main>
  );
}
