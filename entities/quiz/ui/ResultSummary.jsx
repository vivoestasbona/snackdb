import Link from 'next/link';

export default function ResultSummary({ title, slug, totalCorrect = 0, totalQuestions = 0, shareUrl = '' }) {
  const rate = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ margin: '8px 0' }}>{title}</h2>

      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 16,
          display: 'flex',
          gap: 16,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            minWidth: 64,
            minHeight: 64,
            borderRadius: '50%',
            border: '6px solid #e5e7eb',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 700,
          }}
        >
          {rate}%
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            정답 {totalCorrect} / {totalQuestions}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>정확 일치만 정답으로 인정(띄어쓰기 포함)</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {/* ✅ 문자열 템플릿으로 링크 생성 */}
        <Link href={`/fun/quiz/${slug}`} style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          다시 풀기
        </Link>

        {shareUrl ? (
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
          >
            결과 링크 열기
          </a>
        ) : null}
      </div>
    </div>
  );
}
