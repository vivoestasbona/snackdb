import QuizMetaForm from '../../../../features/quiz-admin/ui/QuizMetaForm.jsx';

export default function AdminQuizNewPage() {
  return (
    <main style={{ maxWidth: 720, margin: '32px auto', padding: '0 16px', display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>퀴즈 생성</h2>
      <QuizMetaForm />
    </main>
  );
}
