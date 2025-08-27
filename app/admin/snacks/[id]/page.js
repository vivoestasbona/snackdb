// app/admin/snacks/[id]/page.js
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseClient } from "@shared/api/supabaseClient";

export default function SnackDetail() {
  const { id } = useParams();
  const router = useRouter();

  const [authOK, setAuthOK] = useState(false);
  const [item, setItem] = useState(null);
  const [imgUrl, setImgUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [deleting, setDeleting] = useState(false);

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

  // 단건 조회 + 서명 URL 발급
  const loadItem = useCallback(async () => {
    const client = getSupabaseClient();
    setLoading(true);
    setErr("");
    try {
      const { data, error } = await client
        .from("snacks")
        .select("id,name,brand,image_path,created_at,created_by")
        .eq("id", id)
        .single();
      if (error) throw error;
      setItem(data);

      if (data?.image_path) {
        const { data: signed, error: signErr } = await client
          .storage
          .from("snack-images")
          .createSignedUrl(data.image_path, 60 * 60); // 1시간
        if (signErr) {
            console.error("signed url error(detail)", { path: data.image_path, signErr });
            setImgUrl(null);
        } else {
            setImgUrl(signed?.signedUrl ?? null);
        }
      }
    } catch (e) {
      setErr(e.message || "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!authOK || !id) return;
    loadItem();
  }, [authOK, id, loadItem]);

  async function handleDelete() {
    if (!item || deleting) return;
    const ok = window.confirm(`정말 삭제할까요?\n"${item.name}" 항목이 영구 삭제됩니다.`);
    if (!ok) return;

    setDeleting(true);
    setErr("");
    try {
      const client = getSupabaseClient();

      // 1) DB 행 삭제 (RLS: 관리자만 허용 정책이 있어야 함)
      const { error: delErr } = await client
        .from("snacks")
        .delete()
        .eq("id", item.id);
      if (delErr) throw delErr;

      // 2) 스토리지 파일 삭제 (있으면)
      if (item.image_path) {
        // 비공개 버킷: remove는 인증 사용자에 대해 delete policy가 필요
        await client.storage.from("snack-images").remove([item.image_path]);
        // 실패해도 치명적이지 않으니 에러는 굳이 throw 하지 않음
      }

      router.replace("/admin/snacks");
    } catch (e) {
      setErr(e.message || "삭제 실패");
      setDeleting(false);
    }
  }

  if (!authOK) return null;

  return (
    <section className="wrap">
      <div className="card">
        {loading ? (
          <>
            <h1>불러오는 중…</h1>
            <p className="hint">잠시만 기다려 주세요.</p>
          </>
        ) : err ? (
          <>
            <h1>오류</h1>
            <p className="err">{err}</p>
            <div className="row">
              <button onClick={loadItem}>다시 시도</button>
              <Link className="ghost" href="/admin/snacks">목록으로</Link>
            </div>
          </>
        ) : !item ? (
          <>
            <h1>항목이 없습니다</h1>
            <Link href="/admin/snacks">목록으로</Link>
          </>
        ) : (
          <>
            <header className="head">
              <div>
                <h1>{item.name}</h1>
                {item.brand && <p className="brand">{item.brand}</p>}
                <p className="time">등록일: {new Date(item.created_at).toLocaleString()}</p>
              </div>
              <div className="actions">
                <Link className="ghost" href={`/admin/snacks/${item.id}/edit`}>수정</Link>
                <button className="danger" onClick={handleDelete} disabled={deleting}>
                  {deleting ? "삭제 중..." : "삭제"}
                </button>
              </div>
            </header>

            {imgUrl && (
              <div className="image">
                <img src={imgUrl} alt={item.name} />
              </div>
            )}

            <div className="row">
              <Link className="ghost" href="/admin/snacks">← 목록으로</Link>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .wrap { max-width: var(--container-max); margin: 0 auto; padding: 16px; }
        .card { background:#fff; border:1px solid #eee; border-radius:12px; padding:20px; box-shadow:0 6px 18px rgba(0,0,0,0.06); }
        h1 { margin:0 0 6px; font-size:22px; }
        .hint { color:#666; margin:0 0 10px; }
        .err { color:#c00; }
        .head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
        .brand { color:#555; margin:2px 0; }
        .time { color:#777; font-size:13px; margin:6px 0 0; }
        .actions { display:flex; gap:8px; }
        .image img { width:420px; max-width:100%; height:auto; border-radius:10px; border:1px solid #eee; }
        .row { margin-top:12px; display:flex; gap:8px; align-items:center; }
        button, .ghost {
          padding:8px 12px; border-radius:8px; border:1px solid #ddd; background:#f8f8f8; color:#222; text-decoration:none; cursor:pointer;
        }
        .ghost:hover { background:#f1f1f1; }
        .danger { background:#c62828; border-color:#b71c1c; color:#fff; }
        .danger:disabled { opacity:.6; cursor:not-allowed; }
      `}</style>
    </section>
  );
}
