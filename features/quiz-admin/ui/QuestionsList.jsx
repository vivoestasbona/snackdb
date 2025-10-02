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
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ hint_text:'', answer_key_text:'', acceptable_answers:'', imgFile:null, preview:'' });

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

  async function onMove(id, direction) {
    const res = await fetch(`/api/admin/quizzes/${slug}/questions/${id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction }),
    });
    if (!res.ok) { console.error('move failed', await res.text().catch(()=>'')); return; }
    await load();
  }

  function startEdit(r) {
    setEditingId(r.id);
    setEditForm({
      hint_text: r.hint_text || '',
      answer_key_text: r.answer_key_text || '',
      acceptable_answers: Array.isArray(r.acceptable_answers) ? r.acceptable_answers.join(', ') : '',
      imgFile: null,
      preview: r.stimulus_image_path ? toPublicUrl(r.stimulus_image_path) : '',
    });
  }
  function cancelEdit() {
    setEditingId(null);
    setEditForm({ hint_text:'', answer_key_text:'', acceptable_answers:'', imgFile:null, preview:'' });
  }
  function onEditFile(e) {
    const f = e.target.files?.[0] || null;
    setEditForm(prev => ({ ...prev, imgFile: f, preview: f ? URL.createObjectURL(f) : prev.preview }));
  }
  async function saveEdit(r) {
    let stimulus_image_path;
    // 1) 이미지 교체가 있는 경우 먼저 업로드
    if (editForm.imgFile) {
      const fd = new FormData();
      fd.append('file', editForm.imgFile);
      fd.append('order', r.order_index); // 같은 파일명 규칙 유지
      const up = await fetch(`/api/admin/quizzes/${slug}/upload`, { method:'POST', body: fd });
      if (!up.ok) { alert('이미지 업로드 실패'); return; }
      const uj = await up.json().catch(() => ({}));
      stimulus_image_path = uj?.path;
    }
    // 2) 필드 업데이트
    const acceptable = editForm.acceptable_answers.split(',').map(s => s.trim()).filter(Boolean);
    const payload = {
      hint_text: editForm.hint_text,
      answer_key_text: editForm.answer_key_text,
      acceptable_answers: acceptable,
    };
    if (stimulus_image_path) payload.stimulus_image_path = stimulus_image_path;

    const res = await fetch(`/api/admin/quizzes/${slug}/questions/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { alert('저장 실패'); return; }
    cancelEdit();
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
                {editingId === r.id ? (
                  <div style={{ display:'grid', gap:8 }}>
                    <div style={{ display:'grid', gap:6 }}>
                      <label>힌트 <input value={editForm.hint_text} onChange={e => setEditForm(f => ({...f, hint_text:e.target.value}))} style={{ padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:8 }} /></label>
                      <label>정답 <input value={editForm.answer_key_text} onChange={e => setEditForm(f => ({...f, answer_key_text:e.target.value}))} style={{ padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:8 }} /></label>
                      <label>허용답(쉼표) <input value={editForm.acceptable_answers} onChange={e => setEditForm(f => ({...f, acceptable_answers:e.target.value}))} style={{ padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:8 }} /></label>
                    </div>
                    <div style={{ display:'grid', gap:6 }}>
                      <label>이미지 교체 <input type="file" accept="image/*" onChange={onEditFile} /></label>
                      {editForm.preview ? <img src={editForm.preview} alt="preview" style={{ width: 128, height:128, objectFit:'cover', borderRadius:8, border:'1px solid #e5e7eb' }} /> : null}
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 14 }}>힌트: {r.hint_text || '—'}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                      정답: {r.answer_key_text || '—'}
                      {Array.isArray(r.acceptable_answers) && r.acceptable_answers.length > 0 ? (
                        <span> · 허용: {r.acceptable_answers.join(', ')}</span>
                      ) : null}
                      · 응답형식: {r.response_type}
                    </div>
                  </>
                )}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <button type="button" onClick={() => onMove(r.id, 'up')} style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius: 8 }}>▲</button>
                <button type="button" onClick={() => onMove(r.id, 'down')} style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius: 8 }}>▼</button>
                {editingId === r.id ? (
                  <>
                    <button type="button" onClick={() => saveEdit(r)} style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius: 8 }}>저장</button>
                    <button type="button" onClick={cancelEdit} style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius: 8 }}>취소</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => startEdit(r)} style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius: 8 }}>수정</button>
                    <button type="button" onClick={() => onDelete(r.id)} style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius: 8 }}>삭제</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
