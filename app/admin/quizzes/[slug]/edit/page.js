import QuizEditClient from '../../../../../features/quiz-admin/ui/QuizEditClient.jsx';

export default async function AdminQuizEditPage({ params }) {
  const { slug } = (await params) ?? {};
  return (
    <main style={{ maxWidth: 840, margin: '32px auto', padding: '0 16px', display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>퀴즈 편집: {slug}</h2>
      {/* Server→Client로는 slug(문자열)만 전달 */}
      <QuizEditClient slug={slug} />
    </main>
  );
}
