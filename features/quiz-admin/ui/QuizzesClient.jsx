// features/quiz-admin/ui/QuizzesClient.jsx
'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function QuizzesClient({ initialRows = [] }) {
  const [rows, setRows] = useState(initialRows);
  const [pending, setPending] = useState(false);

  async function onDelete(slug) {
    if (!slug) return;
    if (!confirm('이 퀴즈 세트를 삭제할까요? (문항도 함께 삭제됩니다)')) return;

    setPending(true);
    const res = await fetch(`/api/admin/quizzes/${slug}?with_assets=1`, { method: 'DELETE' });
    setPending(false);

    if (!res.ok) {
      console.error('delete failed', await res.text().catch(() => ''));
      alert('삭제 실패');
      return;
    }
    setRows(prev => prev.filter(r => r.slug !== slug));
  }

  return (
    <div style={{ display:'grid', gap: 8 }}>
      {rows.length === 0 ? (
        <div style={{ color:'#6b7280' }}>아직 퀴즈가 없습니다.</div>
      ) : rows.map(r => (
        <div
          key={r.slug}
          style={{
            display:'grid',
            gridTemplateColumns:'1fr auto',
            alignItems:'center',
            border:'1px solid #e5e7eb',
            borderRadius:8,
            padding:12
          }}
        >
          <div>
            <div style={{ fontWeight:600 }}>{r.title}</div>
            <div style={{ fontSize:12, color:'#6b7280' }}>
              /fun/quiz/{r.slug} · {r.visibility} · {r.status}{r.is_published ? '' : ' (미발행)'}
            </div>
            {r.description ? (
              <div style={{ fontSize:13, color:'#4b5563', marginTop:4 }}>{r.description}</div>
            ) : null}
          </div>

          <div style={{ display:'flex', gap:8 }}>
            <Link
              href={`/admin/quizzes/${r.slug}/edit`}
              style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius:8 }}
            >
              편집
            </Link>
            <a
              href={`/fun/quiz/${r.slug}`}
              target="_blank"
              rel="noopener"
              style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius:8 }}
            >
              공개 페이지
            </a>
            <button
              type="button"
              onClick={() => onDelete(r.slug)}
              disabled={pending}
              style={{ padding:'6px 10px', border:'1px solid #ef4444', color:'#ef4444', borderRadius:8 }}
            >
              삭제
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
