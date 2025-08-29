"use client";

import { useEffect, useRef, useState } from "react";
import { searchKeywords } from "@features/keywords/model/searchKeywords";

export default function TagInput({
    value = [],
    onChange,
    placeholder = "키워드 입력…",
    commitPendingRef, // ← 추가: 부모가 제출 직전에 미확정 입력을 강제로 확정할 수 있게
}) {
  const [q, setQ] = useState("");
  const [suggest, setSuggest] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  function add(name) {
    const n = normalize(name);
    if (!n) return;
    if (value.some(v => v.toLowerCase() === n.toLowerCase())) return;
    onChange?.([...value, n]);
    setQ("");
    setSuggest([]);
  }
  function remove(name) {
    onChange?.(value.filter(v => v.toLowerCase() !== name.toLowerCase()));
  }

  // 부모 쪽에서 "제출 직전" 호출할 수 있는 커밋 함수 노출
  useEffect(() => {
    if (!commitPendingRef) return;
    commitPendingRef.current = () => {
      const t = (q || "").trim();
      if (!t) return value; // 아무 것도 입력 안 돼 있으면 현재 값 그대로
      const n = normalize(t);
      if (value.some(v => v.toLowerCase() === n.toLowerCase())) {
        setQ(""); setSuggest([]); 
        return value; // 중복이면 그대로
      }
      const next = [...value, n];
      onChange?.(next);
      setQ(""); setSuggest([]);
      return next; // 최신 배열을 반환
    };
    return () => { commitPendingRef.current = null; };
  }, [commitPendingRef, q, value, onChange]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const qq = q.trim();
    if (!qq) { setSuggest([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      const rows = await searchKeywords(qq);
      setSuggest(rows || []);
      setLoading(false);
    }, 160);
    return () => timer.current && clearTimeout(timer.current);
  }, [q]);

  return (
    <fieldset className="fieldset">
      <legend>키워드 (자유 입력)</legend>

      <div className="tags">
        {value.map(name => (
          <span key={name.toLowerCase()} className="tag">
            {name}
            <button type="button" aria-label="remove" onClick={() => remove(name)}>×</button>
          </span>
        ))}

        <input
          className="tag-input"
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          onKeyDown={(e)=>{
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(q); }
            else if (e.key === "Backspace" && !q) {
              const last = value[value.length - 1]; if (last) remove(last);
            }
          }}
          placeholder={placeholder}
        />
      </div>

      {!!q && (
        <div className="suggest">
          {loading ? (
            <div className="suggest-row">불러오는 중…</div>
          ) : (
            <>
              {suggest.map(s => (
                <div
                  key={s.id}
                  className="suggest-row"
                  onMouseDown={()=>add(s.name)}
                >
                  {s.name}
                </div>
              ))}
              <div className="suggest-row create" onMouseDown={()=>add(q)}>
                “{q}” 추가
              </div>
            </>
          )}
        </div>
      )}

      <style jsx>{`
        .fieldset { display:grid; gap:8px; }
        .tags { display:flex; gap:8px; flex-wrap:wrap; align-items:center; border:1px solid #ddd; border-radius:8px; padding:8px; }
        .tag { display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border:1px solid #ddd; border-radius:999px; background:#f7f7f7; }
        .tag button { border:none; background:transparent; cursor:pointer; font-size:14px; line-height:1; }
        .tag-input { border:none; outline:none; min-width:140px; padding:4px; }
        .suggest { margin-top:6px; border:1px solid #ddd; border-radius:8px; overflow:hidden; background:#fff; }
        .suggest-row { padding:8px 10px; cursor:pointer; }
        .suggest-row:hover { background:#f5f5f5; }
        .suggest-row.create { color:#0a6; font-weight:600; }
      `}</style>
    </fieldset>
  );
}

function normalize(s){ return (s||"").trim().replace(/\s+/g," "); }
