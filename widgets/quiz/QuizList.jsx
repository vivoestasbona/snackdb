import QuizCard from '../../entities/quiz/ui/QuizCard.jsx';

export default function QuizList({ quizzes = [] }) {
  if (!Array.isArray(quizzes) || quizzes.length === 0) {
    return <div style={{color:'#6b7280'}}>표시할 퀴즈가 없습니다.</div>;
  }
  return (
    <div style={{display:'grid', gap:16}}>
      {quizzes.map((q) => (
        <QuizCard
          key={q.slug}
          slug={q.slug}
          title={q.title}
          description={q.description}
          totalQuestions={q.totalQuestions ?? 0}
          publishedAt={q.publishedAt ?? null}
        />
      ))}
    </div>
  );
}
