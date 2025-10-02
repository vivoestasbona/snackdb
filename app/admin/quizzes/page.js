import Link from 'next/link';
import { getSupabaseAdmin } from '../../../shared/api/supabaseAdmin.js';

export const dynamic = 'force-dynamic';

export default async function AdminQuizzesPage() {
  const supa = getSupabaseAdmin();
  const { data: rows = [], error } = await supa
    .from('quizzes')
    .select('id, title, slug, status, is_published, visibility, created_at')
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

      <div style={{ display: 'grid', gap: 8 }}>
        {rows.length === 0 ? (
          <div style={{ color: '#6b7280' }}>아직 퀴즈가 없습니다.</div>
        ) : rows.map(r => (
          <div key={r.id} style={{ display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center',
                                    border:'1px solid #e5e7eb', borderRadius:8, padding:12 }}>
            <div>
              <div style={{ fontWeight:600 }}>{r.title}</div>
              <div style={{ fontSize:12, color:'#6b7280' }}>
                /fun/quiz/{r.slug} · {r.visibility} · {r.status}{r.is_published ? '' : ' (미발행)'}
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <Link href={`/admin/quizzes/${r.slug}/edit`} style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius:8 }}>
                편집
              </Link>
              <Link href={`/fun/quiz/${r.slug}`} target="_blank" rel="noopener"
                    style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius:8 }}>
                공개 페이지
              </Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
