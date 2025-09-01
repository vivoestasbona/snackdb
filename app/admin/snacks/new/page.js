// app/admin/snacks/new/page.js
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@shared/api/supabaseClient";
import SnackForm from "@widgets/snack-form/ui/SnackForm";

export default function SnackCreatePage() {
  const router = useRouter();
  const [authOK, setAuthOK] = useState(false);

  // 관리자 가드 (+ INITIAL_SESSION 대응)  
  useEffect(() => {
    let mounted = true;
    const client = getSupabaseClient();
    if (!client) return;

    async function resolveSession(session) {
      if (!session) { router.replace("/"); return; }
      const user = session.user;
      const { data, error } = await client
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (error || data?.role !== "admin") { router.replace("/"); return; }
      if (!mounted) return;
      setAuthOK(true);
    }

    client.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data?.session) resolveSession(data.session);
    });

    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        resolveSession(session);
      }
      if (event === "SIGNED_OUT") {
        router.replace("/");
      }
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, [router]);

  if (!authOK) return null;

  return (
    <section className="wrap">
      <div className="card">
        <h1>과자 등록</h1>
        <SnackForm mode="create" onDone={() => router.replace("/admin/snacks")} />
       </div>

      <style jsx>{`
        .wrap { max-width: var(--container-max); margin: 0 auto; padding: 16px; }
        .card { background:#fff; border:1px solid #eee; border-radius:12px; padding:20px; box-shadow:0 6px 18px rgba(0,0,0,0.06); }
        h1 { margin:0 0 12px; font-size:22px; }
      `}</style>
    </section>
  );
}
