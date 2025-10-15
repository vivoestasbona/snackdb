import QuestionStimulusPhoto from '../../entities/quiz/ui/QuestionStimulusPhoto.jsx';

export default function QuizPlayShell({
  question = { imageSrc:'', hintText:'' },
  currentIndex = 1,
  totalQuestions = 1,
  answerForm = null,   // 외부에서 주입(주관식/객관식 등)
}) {
  const headerStyle = {display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12};
  return (
    <section style={{display:'grid', gap:16}}>
      <header style={headerStyle}>
        <div style={{fontWeight:600}}>문제 {currentIndex} / {totalQuestions}</div>
        <div style={{fontSize:12, color:'#6b7280'}}>정확 일치만 정답으로 인정(띄어쓰기 포함)</div>
      </header>

      <QuestionStimulusPhoto
        imageSrc={question.imageSrc}
        hintText={question.hintText}
      />

      {/* 답안 입력 폼 슬롯(외부 주입) */}
      <div>
        {answerForm ?? <div style={{color:'#9CA3AF', fontSize:14}}>답안 입력 폼이 연결되지 않았습니다.</div>}
      </div>
    </section>
  );
}
