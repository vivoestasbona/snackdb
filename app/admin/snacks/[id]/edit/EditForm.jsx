"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SnackForm from "@widgets/snack-form/ui/SnackForm";
import { getSupabaseClient } from "@shared/api/supabaseClient";
import { useRequireAdmin } from "@shared/lib/auth/useRequireAdmin";

export default function EditForm({ initial }) {
  const router = useRouter();
  const { ok, checking } = useRequireAdmin();
  if (checking) return <section className="wrap"><div className="card">권한 확인 중…</div></section>;
  if (!ok) return null;

  return (
    <section className="wrap">
      <div className="card">
        <h1>과자 수정</h1>
        <SnackForm mode="edit" initial={initial} onDone={() => router.replace(`/admin/snacks/${initial.id}`)} />
      </div>
      <style jsx>{`
        .wrap { max-width: var(--container-max); margin: 0 auto; padding: 16px; }
        .card { background:#fff; border:1px solid #eee; border-radius:12px; padding:20px; box-shadow:0 6px 18px rgba(0,0,0,0.06); }
        h1 { margin:0 0 12px; font-size:22px; }
      `}</style>
    </section>
  );
}
