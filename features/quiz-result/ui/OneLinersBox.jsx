'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';

export default function OneLinersBox({ shareCode }) {
  const [items, setItems] = useState([]);
  const [canPost, setCanPost] = useState(false);
  const [value, setValue] = useState('');
  const [pending, startTransition] = useTransition();

  async function load() {
    const res = await fetch(`/api/quiz/one-liners?code=${encodeURIComponent(shareCode)}&limit=30`, { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json().catch(() => ({}));
    if (json.ok) {
      setCanPost(!!json.can_post);
      if (Array.isArray(json.items)) setItems(json.items);
    }
  }

  useEffect(() => { load(); /*eslint-disable-next-line*/ }, [shareCode]);

  async function onDelete(id) {
    if (!id) return;
    if (!confirm('이 한줄평을 삭제할까요?')) return;
    const res = await fetch('/api/quiz/one-liners/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setItems(prev => prev.filter(x => x.id !== id));
    } else {
      console.error('delete failed', await res.text().catch(() => ''));
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!canPost) return; // 방어
    const text = value.trim();
    if (!text) return;
    const res = await fetch('/api/quiz/one-liners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: shareCode, content: text }),
    });
    if (!res.ok) return console.error('one-liner post failed');
    const json = await res.json().catch(() => ({}));
    if (json.ok && json.item) {
      setValue('');
      // 낙관적 prepend
      setItems((prev) => [json.item, ...prev]);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {canPost ? (
        <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8 }}>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="한줄평을 남겨주세요 (최대 200자)"
            maxLength={200}
            style={{ flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
          />
          <button
            type="submit"
            disabled={pending || !value.trim()}
            style={{ padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8 }}
          >
            등록
          </button>
        </form>
      ) : (
        <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, background: '#F9FAFB' }}>
          댓글은 로그인한 회원만 작성할 수 있어요.{' '}
          <Link href="/account" style={{ textDecoration: 'underline' }}>로그인 하러 가기</Link>
        </div>
      )}

      <div style={{ display: 'grid', gap: 8 }}>
        {items.length === 0 ? (
          <div style={{ color: '#9CA3AF', fontSize: 14 }}>아직 한줄평이 없습니다.</div>
        ) : (
          items.map((it) => (
            <div key={it.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {it.author_display_name || '익명'}
                  {Number.isFinite(it.total_correct) && Number.isFinite(it.total_questions) ? (
                    <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280' }}>
                      · 점수 {it.total_correct}/{it.total_questions}
                    </span>
                  ) : null}
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {new Date(it.created_at).toLocaleString()}
                  </div>
                  {it.can_delete ? (
                    <button
                      type="button"
                      onClick={() => onDelete(it.id)}
                      style={{ fontSize:12, padding:'6px 8px', border:'1px solid #e5e7eb', borderRadius:6 }}
                      title="삭제"
                    >
                      삭제
                    </button>
                  ) : null}
                </div>
              </div>
              <div style={{ fontSize: 14, marginTop: 6 }}>{it.content}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
