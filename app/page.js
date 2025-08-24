// app/page.js
export const dynamic = "force-static"; // 정적화(빠름)

export const metadata = {
  title: "SnackDB",
  description: "과자 검색과 리뷰를 위한 데이터베이스",
};

export default function Home() {
  return (
    <section style={{maxWidth:900, margin:"0 auto", padding:"48px 16px", textAlign:"center"}}>
      <h1 style={{margin:"0 0 12px"}}>SnackDB</h1>
      <p style={{margin:"0 0 24px", color:"#555"}}>
        과자 상세 페이지에서 평점과 한줄평을 확인해 보세요.
      </p>
      <a href="/search" style={{
        display:"inline-block", padding:"10px 16px", border:"1px solid #ddd",
        borderRadius:10, textDecoration:"none", color:"#111", background:"#fff"
      }}>
        검색하러 가기 →
      </a>
    </section>
  );
}
