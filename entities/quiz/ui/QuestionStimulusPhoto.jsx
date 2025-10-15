export default function QuestionStimulusPhoto({ imageSrc, alt = 'quiz image', hintText = '' }) {
  return (
    <div style={{display:'grid', gap:12}}>
      <div style={{
        width:'100%', maxWidth:720, aspectRatio:'4 / 3', overflow:'hidden',
        borderRadius:12, border:'1px solid #e5e7eb', background:'#f9fafb'
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={alt}
          style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
        />
      </div>
      {hintText ? (
        <div style={{
          fontSize:14, color:'#374151', background:'#F3F4F6', border:'1px dashed #E5E7EB',
          padding:8, borderRadius:8
        }}>
          힌트: {hintText}
        </div>
      ) : null}
    </div>
  );
}
