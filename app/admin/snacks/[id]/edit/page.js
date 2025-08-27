// app/admin/snacks/[id]/edit/page.js

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseClient } from "@shared/api/supabaseClient";

export default function SnackEdit() {
  const { id } = useParams();
  const router = useRouter();
  const client = getSupabaseClient();

  const [item, setItem] = useState(null);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [file, setFile] = useState(null);
  const [imgUrl, setImgUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [adminReady, setAdminReady] = useState(false);

  // 🔐 관리자 가드: 로그인 + role=admin 아니면 홈으로
  useEffect(() => {
    let mounted = true;
    async function resolve(session) {
      if (!session) { router.replace("/"); return; }
      const { data, error } = await client
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      if (error || data?.role !== "admin") { router.replace("/"); return; }
      if (mounted) setAdminReady(true);
    }
    client.auth.getSession().then(({ data }) => { if (mounted) resolve(data?.session); });
    const { data: sub } = client.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/");
      else resolve(session);
    });
    return () => { mounted = false; sub?.subscription?.unsubscribe?.(); };
  }, [client, router]);

   // 기존 데이터 불러오기
  useEffect(() => {
    if (!adminReady || !id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await client
        .from("snacks")
        .select("id,name,brand,image_path,created_at,is_public")
        .eq("id", id)
        .single();

      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }

        setItem(data);
        setName(data.name);
        setBrand(data.brand);

      if (data.image_path) {
        const { data: signed, error: signErr } = await client
            .storage
            .from("snack-images")
            .createSignedUrl(data.image_path, 60 * 60);
        if (signErr) {
            setImgUrl(null);
        } else {
            setImgUrl(signed?.signedUrl ?? null);
        }
      }
      setLoading(false);
    })();
  }, [id, client, adminReady]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setErr("이름은 반드시 입력해야 합니다.");
      return;
    }

    setSaving(true);
    setErr("");

    try {
      // 1. 이름 중복 검사 (자기 자신 제외)
      const { data: dup } = await client
        .from("snacks")
        .select("id")
        .eq("name", name.trim())
        .neq("id", id);
      if (dup && dup.length > 0) {
        throw new Error("같은 이름의 과자가 이미 존재합니다.");
      }

      let newPath = item.image_path;

      // 2. 새 파일 업로드
      if (file) {
        if (item.image_path) {
          await client.storage.from("snack-images").remove([item.image_path]);
        }
        const path = `${item.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await client.storage
          .from("snack-images")
          .upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        newPath = path;
      }

      // 3. DB 업데이트
      const { error: updErr } = await client
        .from("snacks")
        .update({
          name: name.trim(),
          brand: brand.trim(),
          image_path: newPath
        })
        .eq("id", id);

      if (updErr) throw updErr;

      router.replace(`/admin/snacks/${id}`);
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  }

  if (loading) return <p>불러오는 중...</p>;
  if (!item) return <p>항목을 찾을 수 없습니다.</p>;

  return (
    <section className="wrap">
      <h1>과자 수정</h1>
      {err && <p className="err">{err}</p>}

      <form onSubmit={handleSubmit} className="form">
        <label>
          이름 *
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <label>
          브랜드
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          />
        </label>

        <label>
          이미지 교체
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files[0])}
          />
        </label>

        {imgUrl && (
          <div className="preview">
            <p>현재 이미지:</p>
            <img src={imgUrl} alt="preview" />
          </div>
        )}

        <div className="row">
          <button type="submit" disabled={saving}>
            {saving ? "저장 중..." : "저장"}
          </button>
          <button type="button" onClick={() => router.back()}>
            취소
          </button>
        </div>
      </form>

      <style jsx>{`
        .wrap { max-width:600px; margin:0 auto; padding:16px; }
        h1 { margin-bottom:16px; }
        .form { display:flex; flex-direction:column; gap:14px; }
        label { display:flex; flex-direction:column; gap:4px; }
        input { padding:8px; border:1px solid #ccc; border-radius:6px; }
        .row { display:flex; gap:8px; margin-top:12px; }
        .err { color:#c00; }
        .preview img { max-width:300px; border:1px solid #ccc; border-radius:6px; margin-top:8px; }
      `}</style>
    </section>
  );
}
