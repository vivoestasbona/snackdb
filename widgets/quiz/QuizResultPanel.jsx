import ResultSummary from '../../entities/quiz/ui/ResultSummary.jsx';

export default function QuizResultPanel({
  title,
  slug,
  totalCorrect = 0,
  totalQuestions = 0,
  shareUrl = '',
  oneLinersSlot = null,
}) {
  return (
    <section style={{display:'grid', gap:16}}>
      <ResultSummary
        title={title}
        slug={slug}
        totalCorrect={totalCorrect}
        totalQuestions={totalQuestions}
        shareUrl={shareUrl}
      />

      {/* 한줄평 영역(후속 연결) */}
      <div style={{marginTop:8}}>
        <h3 style={{margin:'12px 0 8px'}}>한줄평</h3>
        {oneLinersSlot ?? (
          <div style={{
            border:'1px dashed #e5e7eb', padding:12, borderRadius:8, color:'#9CA3AF', fontSize:14
          }}>
            한줄평 UI가 아직 연결되지 않았습니다.
          </div>
        )}
      </div>
    </section>
  );
}
