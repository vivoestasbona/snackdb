// features/delete-snack/ui/DeleteButton.jsx
"use client";
import { useState } from "react";
import { deleteSnacks } from "../model/deleteSnacks";

export default function DeleteButton({
  snackId,
  snackName,
  onDeleted,
  variant = "button", // "button" | "link" | "icon"
  title = "삭제",
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    const ok = confirm(`정말 삭제할까요?\n"${snackName || ""}"`);
    if (!ok) return;
    setLoading(true);
    try {
      await deleteSnacks(snackId);
      onDeleted?.(snackId);
    } catch (e) {
      alert(e.message || "삭제 실패");
    } finally {
      setLoading(false);
    }
  }

  if (variant === "icon") {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="xBtn"
          aria-label={title}
          title={title}
        >
          <span aria-hidden>×</span>
          <span className="sr">삭제</span>
        </button>
        <style jsx>{`
          .xBtn {
            appearance: none;
            background: transparent;
            border: 0;
            padding: 0 2px;
            margin: 0;
            display: inline-flex;
            align-items: center;          /* 세로 정렬 깔끔 */
            justify-content: center;
            min-width: 24px;              /* 터치 영역 확보 */
            min-height: 24px;
            line-height: 1;
            font: inherit;                 /* 주변 텍스트와 동일한 폰트 */
            font-weight: 700;              /* X 가독성 */
            color: inherit;                /* 링크 색상과 동기화 */
            cursor: pointer;
            opacity: 0.9;
          }
          .xBtn:hover:not(:disabled) { opacity: 1; }
          .xBtn:disabled { opacity: 0.5; cursor: default; }
          .sr {
            position: absolute;
            width: 1px; height: 1px; padding: 0; margin: -1px;
            overflow: hidden; clip: rect(0 0 0 0); border: 0; white-space: nowrap;
          }
        `}</style>
      </>
    );
  }

  if (variant === "link") {
    return (
      <>
        <button type="button" onClick={handleClick} disabled={loading} className="linkBtn" title={title}>
          {loading ? "삭제 중…" : "삭제"}
        </button>
        <style jsx>{`
          .linkBtn { background:transparent; border:0; padding:0; margin:0; display:inline; color:inherit; font:inherit; line-height:1; cursor:pointer; text-decoration:underline; }
          .linkBtn:hover:not(:disabled){ text-decoration:none; }
          .linkBtn:disabled{ opacity:.6; cursor:default; text-decoration:none; }
        `}</style>
      </>
    );
  }

  return (
    <button type="button" onClick={handleClick} disabled={loading} title={title}>
      {loading ? "삭제 중…" : "삭제"}
    </button>
  );
}
