import Link from 'next/link';
import { getSupabaseAdmin } from '../../../shared/api/supabaseAdmin.js';
import QuizzesClient from '../../../features/quiz-admin/ui/QuizzesClient.jsx';

export const dynamic = 'force-dynamic';

export default async function AdminQuizzesPage() {
  const supa = getSupabaseAdmin();
  const { data: rows = [], error } = await supa
    .from('quizzes')
    .select('id, title, slug, status, is_published, visibility, description, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <main style={{ maxWidth: 960, margin: '32px auto', padding: '0 16px', display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>퀴즈 관리</h2>

      <div>
        <Link href="/admin/quizzes/new" style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          새 퀴즈 만들기
        </Link>
      </div>

      <QuizzesClient initialRows={rows} />
    </main>
  );
}
