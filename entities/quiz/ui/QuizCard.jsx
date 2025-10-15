import Link from 'next/link';

export default function QuizCard({ slug, title, description, totalQuestions = 0, publishedAt = null }) {
  return (
    <div style={{
      border:'1px solid #e5e7eb', borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:8
    }}>
      <h3 style={{fontSize:18, margin:0}}>
        {/* 제목 클릭 → 퀴즈 시작 화면 */}
        <Link href={`/fun/quiz/${slug}`} style={{textDecoration:'none', color:'inherit'}}>
          {title}
        </Link>
      </h3>

      {description ? <p style={{margin:'4px 0 0 0', color:'#4b5563'}}>{description}</p> : null}

      <div style={{marginTop:8, display:'flex', gap:12, fontSize:12, color:'#6b7280'}}>
        <span>문항 {totalQuestions}개</span>
        {publishedAt ? <span>발행: {new Date(publishedAt).toLocaleDateString()}</span> : null}
      </div>

      <div style={{marginTop:12}}>
        {/* 버튼 클릭 → 퀴즈 시작 화면 */}
        <Link
          href={`/fun/quiz/${slug}`}
          style={{ display:'inline-block', padding:'8px 12px', borderRadius:8, border:'1px solid #e5e7eb' }}
        >
          시작하기
        </Link>
      </div>
    </div>
  );
}
