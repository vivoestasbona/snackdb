'use client';

import { useEffect, useState } from 'react';

function toPublicUrl(storagePath) {
  if (!storagePath) return '';
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${storagePath}`;
}

export default function QuestionsList({ slug, reloadSignal = 0 }) {
  const [rows, setRows] = useState([]);
  const [title, setTitle] = useState('');

  async function load() {
    const res = await fetch(`/api/admin/quizzes/${slug}/questions`, { cache: 'no-store' });
    if (!res.ok) return;
    const j = await res.json().catch(() => ({}));
    if (j.ok) {
      setTitle(j.quiz?.title || '');
      setRows(Array.isArray(j.items) ? j.items : []);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [slug, reloadSignal]);

  async function onDelete(id) {
    if (!id) return;
    if (!confirm('이 문항을 삭제할까요?')) return;
    const res = await fetch(`/api/admin/quizzes/${slug}/questions/${id}/delete`, { method: 'POST' });
    if (!res.ok) {
      console.error('delete failed', await res.text().catch(() => ''));
      alert('삭제 실패');
      return;
    }
    // 성공 시 목록 새로고침
    await load();
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h3 style={{ margin: 0 }}>문항 목록 {title ? `— ${title}` : ''}</h3>
      {rows.length === 0 ? (
        <div style={{ color: '#6b7280' }}>아직 문항이 없습니다.</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {rows.map(r => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: 12, border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>#{r.order_index}</div>
                {r.stimulus_image_path ? (
                  <img src={toPublicUrl(r.stimulus_image_path)} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb' }} />
                ) : null}
              </div>
              <div>
                <div style={{ fontSize: 14 }}>힌트: {r.hint_text || '—'}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>정답: {r.answer_key_text || '—'} · 응답형식: {r.response_type}</div>
              </div>
              <div style={{ display:'flex', alignItems:'center' }}>
                <button
                  type="button"
                  onClick={() => onDelete(r.id)}
                  style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius: 8 }}
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
