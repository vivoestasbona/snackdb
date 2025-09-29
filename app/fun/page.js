import QuizList from '../../widgets/quiz/QuizList.jsx';

export default function FunHubPage() {
  // 더미: 이후 실제 DB 연결 예정
  const quizzes = [
    {
      slug: 'photo-guess-sample-01',
      title: '샘플 사진 퀴즈',
      description: '사진 보고 정확히 입력하세요(띄어쓰기 포함).',
      totalQuestions: 3,
      publishedAt: new Date().toISOString(),
    },
  ];
  return (
    <main style={{maxWidth:960, margin:'32px auto', padding:'0 16px', display:'grid', gap:16}}>
      <h1 style={{margin:0}}>즐길거리</h1>
      <section>
        <h2 style={{margin:'16px 0 8px'}}>퀴즈</h2>
        <QuizList quizzes={quizzes} />
      </section>
    </main>
  );
}
