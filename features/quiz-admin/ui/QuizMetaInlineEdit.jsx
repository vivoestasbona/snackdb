'use client';

import { useEffect, useMemo, useState } from 'react';

export default function QuizMetaInlineEdit({
  slug,
  initialTitle = '',
  initialDescription = '',
}) {
  const [form, setForm] = useState({ title: initialTitle, description: initialDescription });
  const [saved, setSaved] = useState({ title: initialTitle, description: initialDescription });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setForm({ title: initialTitle, description: initialDescription });
    setSaved({ title: initialTitle, description: initialDescription });
  }, [initialTitle, initialDescription]);

  const dirty = useMemo(
    () => form.title !== saved.title || form.description !== saved.description,
    [form, saved]
  );

  async function onSave() {
    if (!form.title.trim()) {
      alert('제목을 입력하세요.');
      return;
    }
    setPending(true);
    const res = await fetch(`/api/admin/quizzes/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: form.title, description: form.description }),
    });
    setPending(false);
    if (!res.ok) {
      console.error('save meta failed', await res.text().catch(()=> ''));
      alert('저장 실패');
      return;
    }
    setSaved(form);
    alert('저장되었습니다.');
  }

  function onReset() {
    setForm(saved);
  }

  return (
    <section style={{ display:'grid', gap:12, border:'1px solid #e5e7eb', borderRadius:12, padding:16 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
        <a href={`/fun/quiz/${slug}`} target="_blank" rel="noopener"
           style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius:8 }}>
          공개 페이지 열기
        </a>
      </div>

      <label style={{ display:'grid', gap:6 }}>
        <span>제목</span>
        <input
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="퀴즈 제목"
          style={{ padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:8 }}
        />
      </label>

      <label style={{ display:'grid', gap:6 }}>
        <span>소개</span>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          rows={3}
          placeholder="퀴즈 소개(선택)"
          style={{ padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:8 }}
        />
      </label>

      <div style={{ display:'flex', gap:8 }}>
        <button
          type="button"
          onClick={onSave}
          disabled={pending || !dirty}
          style={{ padding:'8px 12px', border:'1px solid #e5e7eb', borderRadius:8 }}
        >
          {pending ? '저장 중…' : '저장'}
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={pending || !dirty}
          style={{ padding:'8px 12px', border:'1px solid #e5e7eb', borderRadius:8 }}
        >
          취소
        </button>
      </div>
    </section>
  );
}
