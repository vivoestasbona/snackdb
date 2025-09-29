import { redirect, notFound } from 'next/navigation';
import ResultSummary from '../../../../../../entities/quiz/ui/ResultSummary.jsx';
import { getResultByShareCode } from '../../../../../../entities/quiz/model/getResultByShareCode.js';

export default async function QuizResultPage({ params }) {
  // Next 15: params는 Promise
  const { slug: slugInPath, code } = (await params) ?? {};
  if (!slugInPath || !code) notFound();

  // share_code로 결과 조회 (slug/title/합계 포함)
  const result = await getResultByShareCode(code).catch(() => null);
  if (!result) notFound();

  // 결과의 slug와 URL slug가 다르면 정규화된 경로로 리다이렉트
  if (result.slug && result.slug !== slugInPath) {
    redirect(`/fun/quiz/${result.slug}/result/${code}`);
  }

  const shareUrl = `/fun/quiz/${result.slug}/result/${result.share_code}`;

  return (
    <main style={{ maxWidth: 720, margin: '32px auto', padding: '0 16px', display: 'grid', gap: 16 }}>
      <ResultSummary
        title={result.title}
        slug={result.slug}
        totalCorrect={result.total_correct}
        totalQuestions={result.total_questions}
        shareUrl={shareUrl}
      />
      {/* 한줄평 영역은 다음 파트에서 연결 */}
    </main>
  );
}
