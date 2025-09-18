// app/admin/snacks/[id]/edit/page.js
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseClient } from "@shared/api/supabaseClient";
import SnackForm from "@widgets/snack-form/ui/SnackForm";

export default function SnackEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const sb = getSupabaseClient();

  const [authOK, setAuthOK] = useState(false);
  const [initial, setInitial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // 🔐 관리자 가드 (new 페이지와 동일 패턴)
  useEffect(() => {
    let mounted = true;

    async function resolveSession(session) {
      if (!session) { router.replace("/"); return; }
      const { data, error } = await sb
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      if (error || data?.role !== "admin") { router.replace("/"); return; }
      if (mounted) setAuthOK(true);
    }

    sb.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data?.session) resolveSession(data.session);
    });

    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        resolveSession(session);
      }
      if (event === "SIGNED_OUT") {
        router.replace("/");
      }
    });

    return () => { mounted = false; sub?.subscription?.unsubscribe?.(); };
  }, [router, sb]);

  // 📥 기존 데이터 로드 (snack 기본, 맛 매핑, 키워드, 이미지 URL)
  useEffect(() => {
    if (!authOK || !id) return;
    let aborted = false;

    (async () => {
      try {
        setLoading(true);

        // snacks 기본 정보
        const { data: snack, error: snackErr } = await sb
          .from("snacks")
          .select("id,slug,name,brand,image_path,type_id")
          .eq("id", id)
          .single();
        if (snackErr || !snack) throw new Error(snackErr?.message || "항목을 찾을 수 없습니다.");

        // 맛 매핑
        const { data: fm } = await sb
          .from("snack_flavors_map")
          .select("flavor_id")
          .eq("snack_id", id);

        // 키워드(이름 배열)
        const { data: kwRows } = await sb
          .from("snack_keywords_map")
          .select("kw:snack_keywords(name)")
          .eq("snack_id", id);

        // 서명 URL (미리보기)
        let imageUrl = "";
        if (snack.image_path) {
          const { data: signed, error: signErr } =
            await sb.storage.from("snack-images").createSignedUrl(snack.image_path, 60 * 60);
          if (!signErr) imageUrl = signed?.signedUrl || "";
        }

        if (aborted) return;
        setInitial({
          id: snack.id,
          slug: snack.slug,
          name: snack.name || "",
          brand: snack.brand || "",
          typeId: snack.type_id ?? "",
          imagePath: snack.image_path || null,
          imageUrl,
          flavorIds: (fm || []).map(r => r.flavor_id),       // ← SnackForm이 그대로 사용
          tags: (kwRows || []).map(r => r.kw?.name).filter(Boolean),
        });
        setErr("");
      } catch (e) {
        if (!aborted) setErr(e.message || "불러오기 실패");
      } finally {
        if (!aborted) setLoading(false);
      }
    })();

    return () => { aborted = true; };
  }, [authOK, id, sb]);

  if (!authOK) return null;
  if (loading) return <p style={{padding:16}}>불러오는 중…</p>;
  if (err) return <p style={{padding:16, color:"#c00"}}>{err}</p>;
  if (!initial) return <p style={{padding:16}}>항목을 찾을 수 없습니다.</p>;

  return (
    <section className="wrap">
      <div className="card">
        <h1>과자 수정</h1>
        <SnackForm
          mode="edit"
          initial={initial}
          onDone={(savedSlug) =>
            router.replace(`/snacks/${encodeURIComponent(savedSlug ?? initial.slug)}?preview=1`)
          }
        />
      </div>

      <style jsx>{`
        .wrap { max-width: var(--container-max); margin: 0 auto; padding: 16px; }
        .card { background:#fff; border:1px solid #eee; border-radius:12px; padding:20px; box-shadow:0 6px 18px rgba(0,0,0,0.06); }
        h1 { margin:0 0 12px; font-size:22px; }
      `}</style>
    </section>
  );
}
