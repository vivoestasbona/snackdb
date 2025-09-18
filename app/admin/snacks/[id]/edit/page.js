// app/admin/snacks/[id]/edit/page.js
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@shared/api/supabaseClient";
import SnackForm from "@widgets/snack-form/ui/SnackForm";

export default function SnackEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const search = useSearchParams();
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

  // 📥 기존 데이터 로드 (+ 프리필 적용)
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

        // 맛 매핑 (현재 연결된 flavor id들)
        const { data: fm } = await sb
          .from("snack_flavors_map")
          .select("flavor_id")
          .eq("snack_id", id);

        // 키워드(이름 배열)
        const { data: kwRows } = await sb
          .from("snack_keywords_map")
          .select("kw:snack_keywords(name)")
          .eq("snack_id", id);

        // 이미지 서명 URL (미리보기)
        let imageUrl = "";
        if (snack.image_path) {
          const { data: signed, error: signErr } =
            await sb.storage.from("snack-images").createSignedUrl(snack.image_path, 60 * 60);
          if (!signErr) imageUrl = signed?.signedUrl || "";
        }

        // 기본 초기값
        let typeId = snack.type_id ?? "";
        let flavorIds = (fm || []).map(r => r.flavor_id);
        let tags = (kwRows || []).map(r => r.kw?.name).filter(Boolean);

        // ─────────────────────────────────────────────────────────
        // 🔽 프리필 적용: ?prefill=field:op:value (예: flavor:add:달달)
        // 여러 개가 올 수도 있어 getAll 처리
        const prefillParams = search?.getAll("prefill") || [];
        if (prefillParams.length) {
          // 미리 로드: 이름→id 매핑이 필요한 경우에만 가져옴
          let flavorNameToId = null;
          let typeNameToId = null;

          const ensureFlavorMap = async () => {
            if (flavorNameToId) return;
            // 테이블명은 프로젝트에서 사용 중인 명칭에 맞춰 조정 가능: snack_flavors(id,name)
            const { data: flavors } = await sb.from("snack_flavors").select("id,name");
            flavorNameToId = new Map((flavors || []).map(f => [String(f.name).trim(), f.id]));
          };
          const ensureTypeMap = async () => {
            if (typeNameToId) return;
            // 테이블명: snack_types(id,name)
            const { data: types } = await sb.from("snack_types").select("id,name");
            typeNameToId = new Map((types || []).map(t => [String(t.name).trim(), t.id]));
          };

          for (const token of prefillParams) {
            const [rawField, rawOp, ...rest] = String(token).split(":");
            if (!rawField || !rawOp || !rest.length) continue;
            const field = rawField.trim();           // "flavor" | "keyword" | "type"
            const op = rawOp.trim();                 // "add" | "remove"
            const value = rest.join(":").trim();     // 값 안에 ":"가 있을 경우 고려

            if (!value) continue;

            // 맛
            if (field === "flavor") {
              await ensureFlavorMap();
              const fid = flavorNameToId?.get(value);
              if (!fid) continue;
              if (op === "add") {
                if (!flavorIds.includes(fid)) flavorIds = [...flavorIds, fid];
              } else if (op === "remove") {
                flavorIds = flavorIds.filter(v => v !== fid);
              }
            }

            // 키워드(문자열 그대로)
            if (field === "keyword") {
              if (op === "add") {
                if (!tags.includes(value)) tags = [...tags, value];
              } else if (op === "remove") {
                tags = tags.filter(v => v !== value);
              }
            }

            // 종류(단일 선택 가정: type_id 교체/비우기)
            if (field === "type") {
              await ensureTypeMap();
              if (op === "add") {
                const tid = typeNameToId?.get(value);
                if (tid) typeId = tid;
              } else if (op === "remove") {
                // 필요 시 그대로 두고 무시해도 되지만, 요청 의도 반영 차원에서 비워둠
                typeId = "";
              }
            }
          }
        }
        // ─────────────────────────────────────────────────────────

        if (aborted) return;
        setInitial({
          id: snack.id,
          slug: snack.slug,
          name: snack.name || "",
          brand: snack.brand || "",
          typeId,                      // ← 프리필 반영
          imagePath: snack.image_path || null,
          imageUrl,
          flavorIds,                   // ← 프리필 반영
          tags,                        // ← 프리필 반영
        });
        setErr("");
      } catch (e) {
        if (!aborted) setErr(e.message || "불러오기 실패");
      } finally {
        if (!aborted) setLoading(false);
      }
    })();

    return () => { aborted = true; };
  }, [authOK, id, sb, search]);

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
