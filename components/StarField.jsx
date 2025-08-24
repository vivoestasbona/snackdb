// components/StarField.jsx
"use client";
import { useState } from "react";

export default function StarField({ label, value, onChange }) {
  const [hover, setHover] = useState(null);
  const current = hover ?? value ?? 0;

  const Star = ({ filled }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 17.27l-5.4 3.18 1.64-5.81L3 9.5l5.91-.51L12 3.5l3.09 5.49 5.91.51-5.24 5.14 1.64 5.81z"
        fill={filled ? "#f5a623" : "none"}
        stroke="#f5a623"
      />
    </svg>
  );

  const clickStar = (n) => onChange?.(value === n ? null : n);

  return (
    <div className="starField">
      <span className="label">{label}</span>
      <div
        className="stars"
        role="radiogroup"
        aria-label={`${label} 별점`}
        onMouseLeave={()=>setHover(null)}
      >
        {[1,2,3,4,5].map((n)=>(
          <button
            key={n}
            type="button"
            className="starBtn"
            onClick={()=>clickStar(n)}
            onMouseEnter={()=>setHover(n)}
            aria-checked={value === n}
            role="radio"
            aria-label={`${label} ${n}점`}
          >
            <Star filled={n <= current} />
          </button>
        ))}
      </div>

      <style jsx>{`
        /* 라벨 + 별들을 하나의 가로 줄로, 전체를 중앙정렬하기 쉬운 구조 */
        .starField { display:flex; align-items:center; justify-content:center; gap:10px; --label-w: 108px; }
         .label {
          font-size:12px; color:#555; padding:0 10px; height:28px; line-height:28px;
          border-radius:999px; border:1px solid #eee; background:#f8f8f8;
          display:inline-block; width:var(--label-w); text-align:center; white-space:nowrap;
          font-size:12px; color:#555; padding:0 10px; height:28px; line-height:28px;
          border-radius:999px; border:1px solid #eee; background:#f8f8f8;
         
        }
        .stars { display:flex; gap:4px; }
        /* 동그라미/배경 제거: 투명 버튼로 변경 */
        .starBtn {
          border: none; background: transparent; padding: 2px; line-height: 0; cursor: pointer;
        }
        /* 접근성: 키보드 포커스 시만 윤곽선 */
        .starBtn:focus-visible {
          outline: 2px solid #f5a623; outline-offset: 2px; border-radius: 4px;
        }
        /* 모바일에서 약간 좁혀서 별들과 충돌 방지 */
        @media (max-width: 420px) {
          .starField { --label-w: 96px; }
        }
       `}</style>
    </div>
  );
}
