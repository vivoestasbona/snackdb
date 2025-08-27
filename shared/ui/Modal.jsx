// shared/ui/Modal.jsx
"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function Modal({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="modalRoot" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="modalCard" onMouseDown={(e)=>e.stopPropagation()}>
        {children}
        <button className="close" onClick={onClose} aria-label="닫기">×</button>
      </div>
      <style jsx>{`
        .modalRoot {
          position:fixed; inset:0; background:rgba(0,0,0,.35);
          display:flex; align-items:center; justify-content:center; padding:16px; z-index:1000;
        }
        /* 폭 축소: 520px (모바일은 자동 100%) */
        .modalCard {
          position:relative; width:min(520px, 100%);
          background:#fff; border-radius:12px; border:1px solid #eee; padding:16px;
          box-shadow:0 12px 40px rgba(0,0,0,.12);
        }
        .close {
          position:absolute; top:8px; right:8px; border:1px solid #ddd; background:#fff;
          border-radius:8px; padding:4px 8px; cursor:pointer;
        }
      `}</style>
    </div>,
    document.body
  );
}
