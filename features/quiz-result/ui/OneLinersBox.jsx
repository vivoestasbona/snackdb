'use client';

import { useEffect, useState, useTransition } from 'react';

export default function OneLinersBox({ shareCode }) {
  const [items, setItems] = useState([]);
  const [value, setValue] = useState('');
  const [pending, startTransition] = useTransition();

  async function load() {
    const res = await fetch(`/api/quiz/one-liners?code=${encodeURIComponent(shareCode)}&limit=30`, { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json().catch(() => ({}));
    if (json.ok && Array.isArray(json.items)) setItems(json.items);
  }

  useEffect(() => { load(); /*eslint-disable-next-line*/ }, [shareCode]);

  async function onSubmit(e) {
    e.preventDefault();
    const text = value.trim();
    if (!text) return;
    const res = await fetch('/api/quiz/one-liners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: shareCode, content: text }),
    });
    if (res.ok) {
      setValue('');
      startTransition(load);
    } else {
      console.error('one-liner post failed');
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
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

      <div style={{ display: 'grid', gap: 8 }}>
        {items.length === 0 ? (
          <div style={{ color: '#9CA3AF', fontSize: 14 }}>아직 한줄평이 없습니다.</div>
        ) : (
          items.map((it) => (
            <div key={it.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 14 }}>{it.content}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                {new Date(it.created_at).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
