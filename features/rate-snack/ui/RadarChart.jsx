// features/rate-snack/ui/RadarChart.jsx
// 서버 컴포넌트로 사용 가능 ("use client" 없음, styled-jsx 미사용)
import { STAT_KEYS as keys, STAT_LABELS as labels } from "@shared/lib/statLabels";

export default function RadarChart({
  values = { tasty:0, value:0, plenty:0, clean:0, addictive:0, count: undefined }, // 평균 값 + (선택)이용자 수
  overlay = null,                     // 내 점수 {tasty,value,plenty,clean,addictive}
  showLegend = false,                 // 필요 시 true로 목록 표시
  max = 5,                            // 점수 최대치
  size = 300                          // SVG 한 변(px)
}) {
  const pad = 36;                     // ← 라벨용 안전 여백(양쪽)
  const cx = size/2, cy = size/2;
  const r = Math.min(size*0.33, 120);           // 내부 반지름
  const labelGap = 22;                           // 꼭짓점 밖 라벨 간격

  const toRad = (deg) => (deg*Math.PI)/180;
  const angleAt = (i) => toRad(-90 + (360/keys.length)*i);

  const ring = (ratio) => keys.map((_, i) => {
    const a = angleAt(i);
    return `${cx + Math.cos(a)*r*ratio},${cy + Math.sin(a)*r*ratio}`;
  }).join(" ");

  const pointPoly = (vals) => keys.map((k, i) => {
    const v = typeof vals?.[k] === "number" ? vals[k] : 0;
    const a = angleAt(i);
    const ratio = Math.max(0, Math.min(1, v / max));
    return `${cx + Math.cos(a)*r*ratio},${cy + Math.sin(a)*r*ratio}`;
  }).join(" ");

  // 전체 평균(차트 하단 표시)
  const overall =
    keys.reduce((s, k) => s + (typeof values?.[k] === "number" ? values[k] : 0), 0) / keys.length;

  // 텍스트 정렬 헬퍼
  const anchorFor = (a) => {
    const cos = Math.cos(a);
    if (cos > 0.35) return "start";
    if (cos < -0.35) return "end";
    return "middle";
  };

  return (
    <div style={{display:"grid", justifyItems:"center", gap:8}}>
      <div style={{display:"flex", gap:12, alignItems:"center"}}>
        {/* 라벨이 잘리지 않도록 viewBox에 여백을 부여 */}
        <svg
          width={size + pad*2}
          height={size + pad*2}
          viewBox={`${-pad} ${-pad} ${size + pad*2} ${size + pad*2}`}
          aria-label="레이더 차트"
        >
          {/* 눈금 원/선 */}
          {[1,2,3,4,5].map(lv=>(
            <polygon key={lv} points={ring(lv/5)} fill="none" stroke="#eee" />
          ))}
          {keys.map((_,i)=>{
            const a = angleAt(i);
            return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a)*r} y2={cy + Math.sin(a)*r} stroke="#eee"/>;
          })}

          {/* 평균 영역 */}
          <polygon points={pointPoly(values)} fill="rgba(11,87,208,.15)" stroke="#0b57d0" />

          {/* 내 점수 오버레이 (희미) */}
          {overlay && (
            <polygon points={pointPoly(overlay)} fill="rgba(0,0,0,.08)" stroke="#777" strokeDasharray="4 4" />
          )}

          {/* 꼭짓점 라벨: 항목명 + (점수) */}
          {keys.map((k, i) => {
            const a = angleAt(i);
            const lx = cx + Math.cos(a)*(r + labelGap);
            const ly = cy + Math.sin(a)*(r + labelGap);
            const val = typeof values?.[k] === "number" ? values[k] : 0;
            const anchor = anchorFor(a);
            // ▶ 라벨 살짝 좌우로 벌리기
            const nudge = 12;                    // 조절 여지 (px) – 6~10 사이 취향대로
            const nx = k === "value" ? lx + nudge   // "가격 만족도" → 오른쪽으로
                     : k === "addictive" ? lx - nudge // "중독성" → 왼쪽으로
                     : lx;
            return (
              <text key={k} x={nx} y={ly} textAnchor="middle" fontSize="12" fill="#333">
                <tspan x={nx} dy="0">{labels[i]}</tspan>
                <tspan x={nx} dy="1.2em" fill="#666">({val.toFixed(1)})</tspan>
              </text>
            );
          })}
        </svg>

        {/* 선택: 우측 범례(항목 리스트) */}
        {showLegend && (
          <ul style={{listStyle:"none", margin:0, padding:0, fontSize:14, color:"#555"}}>
            {labels.map((lb,i)=>(
              <li key={lb} style={{marginBottom:4}}>
                {lb}: {(values?.[keys[i]] ?? 0).toFixed
                  ? values[keys[i]].toFixed(1)
                  : (values?.[keys[i]] || 0)}
                {typeof overlay?.[keys[i]] === "number" &&
                  <> · <span style={{color:"#777"}}>내 점수 {overlay[keys[i]]}</span></>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 전체 평균 평점 */}
      <div style={{fontSize:14, color:"#333"}}>
        전체 평균 {isFinite(overall) ? overall.toFixed(1) : "0.0"}점
        {typeof values?.count === "number" && (
          <span style={{color:"#777"}}>{/* · {values.count}명 */}</span>
        )}
      </div>
    </div>
  );
}
