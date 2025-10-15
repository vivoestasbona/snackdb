'use client';

import { useState } from 'react';

function toPublicUrl(storagePath) {
  if (!storagePath) return '';
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  // 'quiz-images/<...>' → public URL
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${storagePath}`;
}

export default function QuestionCreate({ slug, onCreated }) {
  const [file, setFile] = useState(null);
  const [orderIndex, setOrderIndex] = useState('');
  const [hint, setHint] = useState('');
  const [answer, setAnswer] = useState('');
  const [alts, setAlts] = useState(''); // 쉼표 구분
  const [preview, setPreview] = useState('');
  const [pending, setPending] = useState(false);

  function onFileChange(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (f) setPreview(URL.createObjectURL(f));
    else setPreview('');
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!file) { alert('이미지를 선택하세요'); return; }
    setPending(true);

    // 1) 업로드
    const fd = new FormData();
    fd.append('file', file);
    if (orderIndex) fd.append('order', orderIndex);
    const upRes = await fetch(`/api/admin/quizzes/${slug}/upload`, { method: 'POST', body: fd });
    if (!upRes.ok) {
      const msg = await upRes.text().catch(() => '');
      setPending(false);
      alert('업로드 실패: ' + msg);
      return;
    }
    const up = await upRes.json().catch(() => ({}));
    const storagePath = up?.path;
    if (!storagePath) {
      setPending(false);
      alert('업로드 경로를 받지 못했습니다.');
      return;
    }

    // 2) 문항 생성
    const acceptable = alts.split(',').map(s => s.trim()).filter(Boolean);
    const crRes = await fetch(`/api/admin/quizzes/${slug}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_index: orderIndex ? Number(orderIndex) : undefined,
        stimulus_image_path: storagePath,
        hint_text: hint,
        answer_key_text: answer,
        acceptable_answers: acceptable,
        response_type: 'text',
      }),
    });

    setPending(false);
    if (!crRes.ok) {
      const msg = await crRes.text().catch(() => '');
      alert('문항 생성 실패: ' + msg);
      return;
    }
    const j = await crRes.json().catch(() => ({}));
    if (j.ok) {
      alert('문항이 추가되었습니다.');
      setFile(null); setOrderIndex(''); setHint(''); setAnswer(''); setAlts(''); setPreview('');
      onCreated?.(); // 리스트 새로고침
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
      <h3 style={{ margin: 0 }}>문항 추가</h3>
      <div style={{ display: 'grid', gap: 8 }}>
        <label>이미지 파일
          <input type="file" accept="image/*" onChange={onFileChange} />
        </label>
        {preview ? (
          <img src={preview} alt="미리보기" style={{ maxWidth: 320, borderRadius: 8, border: '1px solid #e5e7eb' }} />
        ) : null}
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <label>문항 번호(없으면 자동) <input value={orderIndex} onChange={e => setOrderIndex(e.target.value)} placeholder="예: 1" style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8 }} /></label>
        <label>힌트 <input value={hint} onChange={e => setHint(e.target.value)} placeholder="정답 글자수 등" style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8 }} /></label>
        <label>정답(정확 일치) <input value={answer} onChange={e => setAnswer(e.target.value)} required style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8 }} /></label>
        <label>허용 오답(동의어, 쉼표로 구분) <input value={alts} onChange={e => setAlts(e.target.value)} placeholder="예: 초코칩, 초코 칩" style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8 }} /></label>
      </div>

      <div>
        <button type="submit" disabled={pending || !file || !answer.trim()} style={{ padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          {pending ? '저장 중...' : '문항 저장'}
        </button>
      </div>
    </form>
  );
}
