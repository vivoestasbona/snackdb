// app/admin/snacks/new/page.js
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@shared/api/supabaseClient";
// import { uploadFileToStorage } from "@features/snack-create/model/uploadFileToStorage"; // ← 중복 함수 충돌 방지 위해 주석
import { createSnack } from "@features/snack-create/model/createSnack";

export default function SnackCreatePage() {
  const router = useRouter();
  const [authOK, setAuthOK] = useState(false);

  // 폼 상태
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");

  // 과자 종류(카테고리)
  const [types, setTypes] = useState([]);      // {id, name}[]
  const [typeId, setTypeId] = useState("");    // 선택된 id
  const [typesLoading, setTypesLoading] = useState(true);

  // 맛 카테고리(다중 선택)
  const [flavors, setFlavors] = useState([]);           // {id,name}[]
  const [selectedFlavors, setSelectedFlavors] = useState([]); // string[] flavor_id
  const [flavorsLoading, setFlavorsLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

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

  // snack_types 로드
  useEffect(() => {
    if (!authOK) return;
    (async () => {
      setTypesLoading(true);
      const client = getSupabaseClient();
      const { data, error } = await client
        .from("snack_types")
        .select("id,name")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) {
        setErr(error.message || "카테고리를 불러오지 못했습니다.");
      } else {
        setTypes(data || []);
        // 기본 선택: 첫 항목
        if ((data || []).length && !typeId) setTypeId(data[0].id);
      }
      setTypesLoading(false);
    })();
  }, [authOK]); // 최초 1회

  // snack_flavors 로드
  useEffect(() => {
    if (!authOK) return;
    (async () => {
      setFlavorsLoading(true);
      const client = getSupabaseClient();
      const { data, error } = await client
        .from("snack_flavors")
        .select("id,name")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) setErr(error.message || "맛 목록을 불러오지 못했습니다.");
      else setFlavors(data || []);
      setFlavorsLoading(false);
    })();
  }, [authOK]);

  function toggleFlavor(id) {
    setSelectedFlavors((prev) =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  // 파일 미리보기  
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // 간단한 랜덤 파일명  
  function cryptoRandom() {
    const a = globalThis.crypto?.getRandomValues?.(new Uint32Array(4));
    return a ? Array.from(a, x => x.toString(16).padStart(8, "0")).join("") : String(Date.now());
  }

  // Storage 업로드 (비공개 버킷) → 저장용 path 반환
  // (원본 파일에 있던 내부 구현을 그대로 사용)  
  async function uploadFileToStorage({ file, userId }) {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      throw new Error("지원되지 않는 이미지 형식입니다. (jpeg/png/webp/gif)");
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("이미지 크기는 최대 5MB입니다.");
    }

    const ext =
      file.type === "image/jpeg" ? "jpg" :
      file.type === "image/png"  ? "png" :
      file.type === "image/webp" ? "webp" :
      file.type === "image/gif"  ? "gif" : "bin";

    const client = getSupabaseClient();
    const path = `${userId}/${cryptoRandom()}.${ext}`;
    const { error } = await client
      .storage
      .from("snack-images")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
    if (error) throw error;
    return path;
  }

  // 제출
  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErr("");

    try {
      const client = getSupabaseClient();
      const { data: s } = await client.auth.getSession();
      const user = s?.session?.user;
      if (!user) throw new Error("로그인이 필요합니다.");

      if (!file) throw new Error("이미지 파일을 업로드해 주세요.");
      if (!typeId) throw new Error("과자 종류를 선택해 주세요.");

      const imagePath = await uploadFileToStorage({ file, userId: user.id });
      const snackId = await createSnack({ name, brand, imagePath, userId: user.id, typeId });

      // 맛 매핑 upsert
      if (selectedFlavors.length) {
        const rows = selectedFlavors.map(fid => ({ snack_id: snackId, flavor_id: fid }));
        const { error: mapErr } = await client
          .from("snack_flavors_map")
          .upsert(rows, { onConflict: "snack_id,flavor_id", ignoreDuplicates: true });
        if (mapErr) throw mapErr;
      }!  

      router.replace("/admin/snacks");
    } catch (e) {
      setErr(e.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  if (!authOK) return null;

  return (
    <section className="wrap">
      <div className="card">
        <h1>과자 등록</h1>
        <form className="form" onSubmit={handleSubmit}>
          <label>
            이름*
            <input
              value={name}
              onChange={(e)=>setName(e.target.value)}
              required
              maxLength={80}
              placeholder="예: 초코칩 쿠키"
            />
          </label>

          <label>
            브랜드
            <input
              value={brand}
              onChange={(e)=>setBrand(e.target.value)}
              maxLength={80}
              placeholder="예: OO제과"
            />
          </label>

          <label>
            과자 종류*
            <select
              value={typeId}
              onChange={(e)=>setTypeId(e.target.value)}
              disabled={typesLoading || !types.length}
              required
            >
              {types.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>

          <fieldset className="fieldset">
          <legend>맛(복수 선택 가능)</legend>
          {flavorsLoading ? (
            <p>맛 목록 불러오는 중…</p>
          ) : !flavors.length ? (
            <p>등록된 맛이 없습니다.</p>
          ) : (
            <div className="chips">
              {flavors.map(f => (
                <label key={f.id} className="chip">
                  <input
                    type="checkbox"
                    checked={selectedFlavors.includes(f.id)}
                    onChange={() => toggleFlavor(f.id)}
                  />
                  <span>{f.name}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

          <label className="block">
            이미지 업로드*
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e)=>setFile(e.target.files?.[0] || null)}
              required
            />
          </label>

          {preview && (
            <div className="preview">
              <img src={preview} alt="미리보기" />
            </div>
          )}

          <div className="row">
            <button type="submit" disabled={saving || !name.trim() || !file || !typeId}>
              {saving ? "저장 중..." : "등록"}
            </button>
            {err && <span className="err">{err}</span>}
          </div>
        </form>
      </div>

      <style jsx>{`
        .wrap { max-width: var(--container-max); margin: 0 auto; padding: 16px; }
        .card { background:#fff; border:1px solid #eee; border-radius:12px; padding:20px; box-shadow:0 6px 18px rgba(0,0,0,0.06); }
        h1 { margin:0 0 12px; font-size:22px; }
        .form { display:grid; gap:12px; }
        label { display:grid; gap:6px; font-size:14px; }
        input[type="text"], input[type="url"], input[type="file"], select {
          padding:10px 12px; border:1px solid #ddd; border-radius:8px; font-size:14px;
        }
        .block { display:grid; gap:6px; }
        .preview img { width: 260px; height: 160px; object-fit: cover; border:1px solid #eee; border-radius:8px; }
        .row { display:flex; gap:10px; align-items:center; }
        button { padding:10px 14px; border:none; border-radius:8px; background:#222; color:#fff; cursor:pointer; }
        .err { color:#c00; font-size:13px; }
        .fieldset { display:grid; gap:8px; }
        .chips { display:flex; flex-wrap:wrap; gap:8px; }
        .chip { display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border:1px solid #ddd; border-radius:999px; }
      `}</style>
    </section>
  );
}
