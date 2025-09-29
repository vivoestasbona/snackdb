// app/fun/quiz/[slug]/page.js
import { notFound } from 'next/navigation';
import QuizStartSection from '../../../../widgets/quiz/QuizStartSection.jsx';
import { getQuizPublicBySlug } from '../../../../entities/quiz/model/getQuizPublicBySlug.js';
import { getQuestionsPublic } from '../../../../entities/quiz/model/getQuestionsPublic.js';

export default async function QuizStartPage({ params }) {
  // Next 15: params는 Promise
  const { slug } = (await params) ?? {};
  if (!slug) notFound();

  // 공개 메타 조회(발행 + public/unlisted)
  const meta = await getQuizPublicBySlug(slug).catch(() => null);
  if (!meta) notFound();

  // 문항 수(정답 제외)
  const questions = await getQuestionsPublic(meta.id).catch(() => []);
  const totalQuestions = Array.isArray(questions) ? questions.length : 0;

  return (
    <main style={{maxWidth:720, margin:'32px auto', padding:'0 16px', display:'grid', gap:16}}>
      <QuizStartSection
        slug={meta.slug}
        title={meta.title}
        description={meta.description ?? ''}
        totalQuestions={totalQuestions}
      />
    </main>
  );
}
