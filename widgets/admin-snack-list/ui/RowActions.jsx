// widgets/admin-snack-list/ui/RowActions.jsx
"use client";

import Link from "next/link";
import DeleteButton from "@features/delete-snacks/ui/DeleteButton";

export default function RowActions({ id, slug, name, brand, onDeleted }) {
  const label = `${brand ? brand + " " : ""}${name || ""}`.trim();

  return (
    <span className="actions">
      <Link href={`/admin/snacks/${id}/edit`}>수정</Link>
      <span className="dot" aria-hidden>·</span>
      {slug ? (
        <Link href={`/snacks/${encodeURIComponent(slug)}?preview=1`} target="_blank">보기</Link>
      ) : (
        <span className="disabled">보기</span>
      )}
      <span className="dot" aria-hidden>·</span>
      <DeleteButton
        snackId={id}
        snackName={label}
        onDeleted={onDeleted}
        variant="icon"     // ⬅️ 아이콘 버튼
        title="과자 삭제"
      />
      <style jsx>{`
        .actions {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }
        .dot { opacity: .5; }
        .disabled { color: #999; }
      `}</style>
    </span>
  );
}
