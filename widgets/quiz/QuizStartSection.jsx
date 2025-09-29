import Link from 'next/link';

export default function QuizStartSection({
  slug,
  title,
  description = '',
  totalQuestions = 0,
  onStart = null,
}) {
  const StartButton = () => {
    const btnStyle = { padding:'10px 14px', border:'1px solid #e5e7eb', borderRadius:8 };
    if (typeof onStart === 'function') {
      return <button type='button' onClick={onStart} style={btnStyle}>시작하기</button>;
    }
    return <Link href={/fun/quiz//q/1} style={btnStyle}>시작하기</Link>;
  };

  return (
    <section style={{display:'grid', gap:12}}>
      <h1 style={{margin:0}}>{title}</h1>
      {description ? <p style={{margin:'4px 0 0 0', color:'#4b5563'}}>{description}</p> : null}
      <div style={{fontSize:12, color:'#6b7280'}}>문항 {totalQuestions}개</div>
      <div><StartButton /></div>
    </section>
  );
}
