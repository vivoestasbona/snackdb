"use client";
import { useState } from "react";
import { getSupabaseClient } from "@shared/api/supabaseClient";
import { promptLogin } from "@entities/user/model/loginPrompt";
import InfoRequestModal from "./InfoRequestModal";

export default function InfoRequestButton({
  snackId,
  initialTypeId = "",
  initialFlavorIds = [],
  initialKeywords = [],
}) {
  const [open, setOpen] = useState(false);
  const sb = getSupabaseClient();

  async function handleClick() {
    const { data: sess } = await sb.auth.getSession();
    const uid = sess?.session?.user?.id;
    if (!uid) {
      promptLogin({ reason: "정보 수정/추가 요청을 하려면 로그인하세요", from: "snack:info-request", snackId });
      return; // 비로그인은 모달 미오픈
    }
    setOpen(true);
  }

  return (
    <>
      <button type="button" className="req" onClick={handleClick}>
        정보 수정/추가 요청
      </button>
      <InfoRequestModal
        open={open}
        onClose={()=>setOpen(false)}
        snackId={snackId}
        initialTypeId={initialTypeId}
        initialFlavorIds={initialFlavorIds}
        initialKeywords={initialKeywords}
     />
      <style jsx>{`
        .req {
          padding: 8px 12px;
          border: 1px solid #c9defc;
          border-radius: 8px;
          background: #eaf3ff;
          color: #0b57d0;
          font-weight: 600;
          cursor: pointer;
        }
        .req:hover { background: #dbeaff; }
      `}</style>
    </>
  );
}
