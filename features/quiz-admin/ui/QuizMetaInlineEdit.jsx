'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function QuizMetaInlineEdit({
  slug,
  initialTitle = '',
  initialDescription = '',
}) {
  const router = useRouter();
  const [form, setForm] = useState({ title: initialTitle, description: initialDescription });
  const [slugForm, setSlugForm] = useState(slug);
  const [saved, setSaved] = useState({ title: initialTitle, description: initialDescription });
  const [pending, setPending] = useState(false);
  const [pendingSlug, setPendingSlug] = useState(false);

  useEffect(() => {
    setForm({ title: initialTitle, description: initialDescription });
    setSaved({ title: initialTitle, description: initialDescription });
    setSlugForm(slug);
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

  async function onChangeSlug() {
    const ns = (slugForm || '').trim().toLowerCase();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(ns) || ns.length < 3 || ns.length > 64) {
      alert('슬러그는 소문자/숫자/하이픈, 3~64자로 입력하세요.'); return;
    }
    if (ns === slug) { alert('변경 사항이 없습니다.'); return; }
    if (!confirm(`URL이 /admin/quizzes/${slug}/edit → /admin/quizzes/${ns}/edit 로 바뀝니다. 진행할까요?`)) return;
    setPendingSlug(true);
    const res = await fetch(`/api/admin/quizzes/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_slug: ns }),
    });
    setPendingSlug(false);
    if (!res.ok) {
      const t = await res.text().catch(()=> '');
      console.error('change slug failed', t);
      alert('슬러그 변경 실패'); return;
    }
    const j = await res.json().catch(()=> ({}));
    if (j?.ok && j?.newSlug) {
      // 관리 편집 페이지를 새 슬러그 경로로 이동
      router.replace(`/admin/quizzes/${j.newSlug}/edit`);
    }
  }

  function onReset() {
    setForm(saved);
  }

  return (
    <section style={{ display:'grid', gap:12, border:'1px solid #e5e7eb', borderRadius:12, padding:16 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:13, color:'#6b7280' }}>slug:</span>
          <input
            value={slugForm}
            onChange={e => setSlugForm(e.target.value)}
            placeholder="slug"
            style={{ padding:'6px 8px', border:'1px solid #e5e7eb', borderRadius:8, width:220 }}
          />
          <button
            type="button"
            onClick={onChangeSlug}
            disabled={pendingSlug}
            style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius:8 }}
          >
            {pendingSlug ? '변경 중…' : '슬러그 변경'}
          </button>
        </div>
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
