import QuizEditClient from '../../../../../features/quiz-admin/ui/QuizEditClient.jsx';
import QuizMetaInlineEdit from '../../../../../features/quiz-admin/ui/QuizMetaInlineEdit.jsx';
import { getSupabaseAdmin } from '../../../../../shared/api/supabaseAdmin.js';

export default async function AdminQuizEditPage({ params }) {
  const { slug } = (await params) ?? {};
  const supa = getSupabaseAdmin();
  const { data: quiz } = await supa
    .from('quizzes')
    .select('title, description')
    .eq('slug', slug)
    .single();

  return (
    <main style={{ maxWidth: 840, margin: '32px auto', padding: '0 16px', display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>퀴즈 편집: {slug}</h2>
      <QuizMetaInlineEdit
        slug={slug}
        initialTitle={quiz?.title || ''}
        initialDescription={quiz?.description || ''}
      />
      {/* Server→Client로는 slug(문자열)만 전달 */}
      <QuizEditClient slug={slug} />
    </main>
  );
}
