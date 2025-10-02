import Link from 'next/link';
import { getSupabaseAdmin } from '../../../shared/api/supabaseAdmin.js';

export const dynamic = 'force-dynamic';

export default async function QuizListPage() {
  const supa = getSupabaseAdmin();
  // 공개 목록엔 'published' + 'public'만
  const { data: rows = [], error } = await supa
    .from('quizzes')
    .select('slug, title, description')
    .eq('status', 'published')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <main style={{ maxWidth: 960, margin:'32px auto', padding:'0 16px', display:'grid', gap:16 }}>
      <h2 style={{ margin: 0 }}>즐길거리 — 퀴즈</h2>
      <p style={{ color:'#6b7280', marginTop:-8 }}>사진 보고 맞히는 주관식 퀴즈부터 시작해 보세요!</p>

      {rows.length === 0 ? (
        <div style={{ color:'#6b7280' }}>아직 공개된 퀴즈가 없습니다.</div>
      ) : (
        <div style={{ display:'grid', gap:12 }}>
          {rows.map(r => (
            <Link key={r.slug} href={`/fun/quiz/${r.slug}`}
                  style={{ display:'block', border:'1px solid #e5e7eb', borderRadius:12, padding:16 }}>
              <div style={{ fontWeight:600 }}>{r.title}</div>
              <div style={{ color:'#6b7280', fontSize:14, marginTop:4 }}>{r.description || '퀴즈 시작하기'}</div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
