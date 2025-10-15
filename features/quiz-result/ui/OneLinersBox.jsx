'use client';

import { useEffect, useState, useTransition } from 'react';
import LoginModal from '../../../entities/user/ui/LoginModal.jsx';

export default function OneLinersBox({ shareCode }) {
  const [items, setItems] = useState([]);
  const [canPost, setCanPost] = useState(false);
  const [value, setValue] = useState('');
  const [pending, startTransition] = useTransition();
  const [showLogin, setShowLogin] = useState(false);
  const [deferredText, setDeferredText] = useState('');
  const [autoSubmitting, setAutoSubmitting] = useState(false);

  const PENDING_KEY = `quiz_pending_one_liner_${shareCode}`;

  async function load() {
    const res = await fetch(`/api/quiz/one-liners?code=${encodeURIComponent(shareCode)}&limit=30`, { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json().catch(() => ({}));
    if (json.ok) {
      setCanPost(!!json.can_post);
      if (Array.isArray(json.items)) setItems(json.items);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [shareCode]);

  // 로그인 이후(리다이렉트 복귀 포함) 자동 제출 브릿지
  useEffect(() => {
    if (!canPost) return;
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      const text = String(obj?.text || '').trim();
      if (!text) { localStorage.removeItem(PENDING_KEY); return; }
      (async () => {
        setAutoSubmitting(true);
        await submitText(text);
        localStorage.removeItem(PENDING_KEY);
        setAutoSubmitting(false);
      })();
    } catch {
      // 파싱 실패 시 안전하게 제거
      try { localStorage.removeItem(PENDING_KEY); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPost, shareCode]);

  async function submitText(text) {
    if (!text) return;
    const res = await fetch('/api/quiz/one-liners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: shareCode, content: text }),
    });
    if (!res.ok) { console.error('one-liner post failed'); return; }
    const json = await res.json().catch(() => ({}));
    if (json.ok && json.item) {
      setValue('');                       // 성공 시 입력창 비우기
      setDeferredText('');                // 예약 텍스트 클리어
      try { localStorage.removeItem(PENDING_KEY); } catch {}
      setItems(prev => [json.item, ...prev]); // 즉시 반영(삭제 버튼 포함)
      startTransition(load);              // 배경 갱신
    }
  }

  async function onSubmit(e) {
    e.preventDefault();

    // 로그인 안 되어 있으면: 입력값을 localStorage에 저장하고 모달만 띄움
    if (!canPost) {
      const t = value.trim();
      if (t) {
        setDeferredText(t);
        try { localStorage.setItem(PENDING_KEY, JSON.stringify({ text: t, ts: Date.now() })); } catch {}
      }
      setShowLogin(true);
      return;
    }

    const text = value.trim();
    if (!text) return;
    await submitText(text); // ✅ 예전 res/json 잔여 코드 삭제
  }

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

  const inputStyle = { flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 };

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {/* 입력폼은 항상 노출 */}
      <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="한줄평을 남겨주세요 (최대 200자)"
          maxLength={200}
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={pending || !value.trim() || autoSubmitting}
          style={{ padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8 }}
        >
          {autoSubmitting ? '등록 중...' : '등록'}
        </button>
      </form>

      {/* 목록 */}
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

      {/* 로그인 모달 */}
      <LoginModal
        open={showLogin}
        onClose={() => { setShowLogin(false); startTransition(load); }}
        onSuccess={async () => {
          setShowLogin(false);
          setCanPost(true); // 즉시 제출 허용
          // 1순위: localStorage(리다이렉트 시에도 남음), 2순위: 메모리(deferredText/value)
          let t = '';
          try {
            const raw = localStorage.getItem(PENDING_KEY);
            if (raw) {
              const obj = JSON.parse(raw);
              t = String(obj?.text || '').trim();
            }
          } catch {}
          if (!t) t = deferredText || value.trim();
          if (t && !autoSubmitting) {
            try {
              setAutoSubmitting(true);
              await submitText(t);
              try { localStorage.removeItem(PENDING_KEY); } catch {}
            } finally {
              setAutoSubmitting(false);
            }
          } else {
            startTransition(load);
          }
        }}
      />
    </div>
  );
}
