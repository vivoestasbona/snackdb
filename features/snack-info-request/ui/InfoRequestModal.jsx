// features/snack-info-request/ui/InfoRequestModal.jsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "@shared/api/supabaseClient";
import { promptLogin } from "@entities/user/model/loginPrompt";
import TypeSelect from "@features/manage-snack-categories/ui/TypeSelect";
import FlavorChipsSelector from "@features/manage-snack-categories/ui/FlavorChipsSelector";
import TagInput from "@features/keywords/ui/TagInput";
import { useSnackFlavors } from "@features/manage-snack-categories/model/useSnackFlavors";
import { useSnackTypes } from "@features/manage-snack-categories/model/useSnackTypes";

export default function InfoRequestModal({
  open, onClose, snackId,
  initialTypeId = "",
  initialFlavorIds = [],
  initialKeywords = [],
}) {
  const sb = getSupabaseClient();

  // 사전목록 로딩 (항상 호출)
  const { flavors } = useSnackFlavors();
  const { types } = useSnackTypes();

  // 동의/상태
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // 폼 상태 (통합 편집: 현재값으로 프리로드)
  const [typeId, setTypeId] = useState("");
  const [flavorIds, setFlavorIds] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [note, setNote] = useState("");
  const commitPendingRef = useRef(null);

  // 모달 열릴 때만 초기값 주입/리셋
  useEffect(() => {
    if (!open) return;
    setAgree(false); setBusy(false); setDone(false); setNote("");
    setTypeId(initialTypeId ?? "");
    setFlavorIds(Array.isArray(initialFlavorIds) ? initialFlavorIds : []);
    setKeywords(Array.isArray(initialKeywords) ? initialKeywords : []);
  }, [open, initialTypeId, initialFlavorIds, initialKeywords]);

  // Esc 닫힘
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // id→name 매핑
  const idToName = (id, list) => (list?.find(x => String(x.id) === String(id))?.name) || null;

  // 제출 가능 여부
  const canSubmit = useMemo(() => {
    // 현재값과 초기값이 하나라도 다르면 true
    const typeChanged = String(typeId || "") !== String(initialTypeId || "");
    const fSet = new Set(flavorIds.map(String));
    const fInit = new Set((initialFlavorIds || []).map(String));
    const flavorsChanged = (flavorIds.length !== (initialFlavorIds || []).length)
      || [...fSet].some(x => !fInit.has(x));
    const kwSet = new Set((keywords || []).map(n => n.toLowerCase()));
    const kwInit = new Set((initialKeywords || []).map(n => n.toLowerCase()));
    const keywordsChanged =
      kwSet.size !== kwInit.size || [...kwSet].some(n => !kwInit.has(n));
    return typeChanged || flavorsChanged || keywordsChanged || !!note.trim();
  }, [typeId, flavorIds, keywords, initialTypeId, initialFlavorIds, initialKeywords, note]);

  async function submit() {
    setBusy(true);
    try {
      const { data: sess } = await sb.auth.getSession();
      const uid = sess?.session?.user?.id;
      if (!uid) {
        promptLogin({ reason: "정보 수정/추가 요청을 하려면 로그인하세요", from: "snack:info-request", snackId });
        setBusy(false); return;
      }
      if (!agree) { alert("안내 및 정책에 동의해 주세요."); setBusy(false); return; }

      // TagInput 입력창의 미확정 문자열까지 확정
      const latestKeywords = commitPendingRef.current ? await commitPendingRef.current() : keywords;

      // ---- diff 계산 ----
      // Type(단일)
      const typeChanged = String(typeId || "") !== String(initialTypeId || "");
      const add_types = typeChanged && typeId ? [idToName(typeId, types)].filter(Boolean) : [];
      const remove_types = typeChanged && initialTypeId ? [idToName(initialTypeId, types)].filter(Boolean) : [];

      // Flavors(다중, id기반 diff 후 name으로 변환)
      const fSet = new Set(flavorIds.map(String));
      const fInit = new Set((initialFlavorIds || []).map(String));
      const addFlavorIds = [...fSet].filter(x => !fInit.has(x));
      const removeFlavorIds = [...fInit].filter(x => !fSet.has(x));
      const add_flavors = addFlavorIds.map(fid => idToName(fid, flavors)).filter(Boolean);
      const remove_flavors = removeFlavorIds.map(fid => idToName(fid, flavors)).filter(Boolean);

      // Keywords(문자열, 대소문자 무시)
      const norm = s => (s || "").trim().replace(/\s+/g, " ").toLowerCase();
      const kwSet = new Set((latestKeywords || []).map(norm));
      const kwInit = new Set((initialKeywords || []).map(norm));
      const add_keywords = [...kwSet].filter(n => !kwInit.has(n));
      const remove_keywords = [...kwInit].filter(n => !kwSet.has(n));

      // 아무 변화도 없으면 안내
      if (
        !add_types.length && !remove_types.length &&
        !add_flavors.length && !remove_flavors.length &&
        !add_keywords.length && !remove_keywords.length &&
        !note.trim()
      ) {
        alert("변경 사항이 없습니다. 항목을 추가/해제해 주세요.");
        setBusy(false); return;
      }

      const payload = {
        snack_id: snackId,
        user_id: uid,              // RLS에서 검사
        add_types, remove_types,
        add_flavors, remove_flavors,
        add_keywords, remove_keywords,
        note,
      };

      const { error } = await sb.from("snack_tag_requests").insert(payload);
      if (error) throw error;
      setDone(true);
    } catch (e) {
      console.error(e);
      alert("요청을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="dim"
      role="dialog"
      aria-modal="true"
      aria-label="정보 수정/추가 요청"
      onMouseDown={onClose}                   /* 바깥 클릭 닫힘 */
    >
      <div className="card" onMouseDown={(e)=>e.stopPropagation()}>
        {!done ? (
          <>
            <h3>정보 수정/추가 요청</h3>
            <p className="help">현재 등록된 값이 적용된 상태에서 변경할 수 있어요. 관리자 화면과 유사한 UI입니다.</p>

            {/* 종류 (단일 선택) */}
            <div className="block">
              <TypeSelect
                value={typeId}
                onChange={setTypeId}
                required={false}
                autoSelectFirst={false}  
              />
            </div>

            {/* 맛 (칩 선택, 복수) */}
            <div className="block">
              <FlavorChipsSelector value={flavorIds} onChange={setFlavorIds} /> {/* :contentReference[oaicite:9]{index=9} */}
            </div>

            {/* 키워드 (자유 입력, 배열) */}
            <div className="block">
              <TagInput
                value={keywords}
                onChange={setKeywords}
                commitPendingRef={commitPendingRef}
                placeholder="키워드 입력 후 Enter (예: 감자, 양파)"
              />
            </div>

            <label className="block">
              설명/근거 (선택)
              <textarea rows={3} value={note} onChange={e=>setNote(e.target.value)} placeholder="왜 수정/추가가 필요한지 간단히 적어주세요." />
            </label>

            {/* 이용정책 동의 */}
            <label className="agree">
              <input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)} />
              <span>사실과 크게 다른 수정 요청을 반복할 시, 서비스 이용이 제한될 수 있음을 이해하고 동의합니다.</span>
            </label>

            <div className="actions">
              <button onClick={onClose} disabled={busy}>취소</button>
              <button onClick={submit} disabled={busy || !agree || !canSubmit}>
                {busy ? "제출 중…" : "요청 제출"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h3>요청이 접수되었습니다</h3>
            <p className="help">감사합니다! 운영자가 검토 후 반영 여부를 결정합니다.</p>
            <div className="actions">
              <button onClick={onClose}>닫기</button>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .dim { position: fixed; inset: 0; background: rgba(0,0,0,.3);
               display:flex; align-items:center; justify-content:center; z-index:9999; }
        .card { width:min(680px,94vw); background:#fff; border:1px solid #eee; border-radius:12px; padding:16px; }
        h3 { margin:0 0 8px; font-size:18px; }
        .help { margin:0 0 12px; color:#666; font-size:13px; }
        .block { display:grid; gap:8px; margin: 10px 0; }
        textarea{ border:1px solid #ddd; border-radius:8px; padding:8px; font-size:14px; outline:none; }
        textarea:focus{ box-shadow:0 0 0 2px rgba(0,0,0,.06) inset; }
        .agree{ display:flex; gap:8px; align-items:flex-start; margin:8px 0 4px; font-size:13px; color:#444; }
        .actions{ display:flex; justify-content:flex-end; gap:8px; margin-top:12px; }
        .actions button{ padding:8px 12px; border:1px solid #ddd; border-radius:8px; background:#f8f8f8; cursor:pointer; }
        .actions button:hover{ background:#f0f0f0; }
      `}</style>
    </div>
  );
}
