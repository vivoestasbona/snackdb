'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function toSlug(s) {
  return (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-_\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default function QuizMetaForm() {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [isPublished, setIsPublished] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function onSubmit(e) {
    e.preventDefault();
    const payload = {
      title: title.trim(),
      slug: (slug || toSlug(title)).trim(),
      description,
      visibility,
      is_published: isPublished,
      template: 'photo_guess',
      response_type: 'text',
    };
    setPending(true);
    const res = await fetch('/api/admin/quizzes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setPending(false);

    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      alert('생성 실패: ' + msg);
      return;
    }

    const json = await res.json().catch(() => ({}));
    if (json.ok) {
      alert('퀴즈가 생성되었습니다.');
      if (isPublished) {
        // 공개 페이지는 새 탭으로
        if (typeof window !== 'undefined') {
          window.open(`/fun/quiz/${json.slug}`, '_blank', 'noopener');
        }
      }
      // 현재 탭은 편집 화면으로 이동해 이어서 작업
      router.push(`/admin/quizzes/${json.slug}/edit`);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
      <label style={{ display: 'grid', gap: 6 }}>
        <span>제목 *</span>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!slug) setSlug(toSlug(e.target.value));
          }}
          required
          placeholder="예) 포토 퀴즈 시즌1"
          style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
        />
      </label>

      <label style={{ display: 'grid', gap: 6 }}>
        <span>슬러그 *</span>
        <input
          value={slug}
          onChange={(e) => setSlug(toSlug(e.target.value))}
          required
          placeholder="예) photo-quiz-s1"
          style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
        />
      </label>

      <label style={{ display: 'grid', gap: 6 }}>
        <span>설명</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
        />
      </label>

      <label style={{ display: 'grid', gap: 6 }}>
        <span>공개 범위</span>
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
          style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
        >
          <option value="public">public</option>
          <option value="unlisted">unlisted</option>
        </select>
      </label>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
        />
        <span>발행(노출)</span>
      </label>

      <div>
        <button
          type="submit"
          disabled={pending || !title.trim()}
          style={{ padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8 }}
        >
          {pending ? '생성 중...' : '퀴즈 생성'}
        </button>
      </div>

      <div style={{ fontSize: 12, color: '#6b7280' }}>
        템플릿: <code>photo_guess</code>, 응답형식: <code>text</code> (MVP 고정)
      </div>
    </form>
  );
}
