// app/admin/snacks/[id]/edit/page.js

"use client";

import { useEffect, useState } from "react";
import TagInput from "@features/keywords/ui/TagInput";
import { ensureKeywords } from "@features/keywords/model/ensureKeywords";
import { mapKeywords } from "@features/keywords/model/mapKeywords";
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

  // 과자 종류 목록
  const [types, setTypes] = useState([]);     // {id,name}[]
  const [typeId, setTypeId] = useState("");   // 선택된 type_id
  const [typesLoading, setTypesLoading] = useState(true);

  const [flavors, setFlavors] = useState([]);
  const [flavorsLoading, setFlavorsLoading] = useState(true);
  const [selectedFlavors, setSelectedFlavors] = useState([]);

  const [keywords, setKeywords] = useState([]); // string[] 선택된 키워드 이름

  function toggleFlavor(id) {
    setSelectedFlavors(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  }

  // 🔐 관리자 가드
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

  // snack_types 로드
  useEffect(() => {
    if (!adminReady) return;
    (async () => {
      setTypesLoading(true);
      const { data, error } = await client
        .from("snack_types")
        .select("id,name")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) {
        setErr(error.message || "카테고리를 불러오지 못했습니다.");
        setTypes([]);
      } else {
        setTypes(data || []);
      }
      setTypesLoading(false);
    })();
  }, [adminReady, client]);

  // snack_flavors 로드
 useEffect(() => {
   if (!adminReady) return;
   (async () => {
     setFlavorsLoading(true);
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
 }, [adminReady, client]);

 // 현재 키워드 매핑 로드
 useEffect(() => {
   if (!adminReady || !id) return;
   (async () => {
     const { data: kwRows, error: kwErr } = await client
       .from("snack_keywords_map")
       .select("kw:snack_keywords(name)")
       .eq("snack_id", id);
     if (!kwErr) {
       setKeywords(
         (kwRows || []).map(r => r.kw?.name).filter(Boolean)
       );
     }
   })();
 }, [adminReady, id, client]);


  // 기존 데이터 불러오기 (+ type_id 포함)
  useEffect(() => {
    if (!adminReady || !id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await client
        .from("snacks")
        .select("id,name,brand,image_path,created_at,is_public,type_id")
        .eq("id", id)
        .single();

      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }

      setItem(data);
      setName(data.name || "");
      setBrand(data.brand || "");
      setTypeId(data.type_id || "");

      // 현재 매핑
      const { data: maps } = await client
        .from("snack_flavors_map")
        .select("flavor_id")
        .eq("snack_id", id);
      setSelectedFlavors((maps || []).map(m => m.flavor_id));

      if (data.image_path) {
        const { data: signed, error: signErr } = await client
          .storage
          .from("snack-images")
          .createSignedUrl(data.image_path, 60 * 60);
        setImgUrl(signErr ? null : (signed?.signedUrl ?? null));
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
    if (!typeId) {
      setErr("과자 종류를 선택해 주세요.");
      return;
    }

    setSaving(true);
    setErr("");

    try {
      // 1) 이름 중복 검사 (자기 자신 제외)
      const { data: dup } = await client
        .from("snacks")
        .select("id")
        .eq("name", name.trim())
        .neq("id", id);
      if (dup && dup.length > 0) {
        throw new Error("같은 이름의 과자가 이미 존재합니다.");
      }

      let newPath = item.image_path;

      // 2) 새 파일 업로드 시 교체
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

      // 3) DB 업데이트 (type_id 포함!)
      const { error: updErr } = await client
        .from("snacks")
        .update({
          name: name.trim(),
          brand: brand.trim(),
          image_path: newPath,
          type_id: typeId,
        })
        .eq("id", id);

      if (updErr) throw updErr;

      // 확정된 칩(키워드)만 저장
      const kwList = Array.isArray(keywords) ? keywords : [];

      // --- 키워드 매핑 갱신: 모두 삭제 → 선택 반영 ---
      const { error: delErr } = await client
        .from("snack_keywords_map")
        .delete()
        .eq("snack_id", id);
      if (delErr) throw delErr;

      if (kwList.length) {
        const ids = await ensureKeywords(kwList);
        const inserted = await mapKeywords(id, ids);
        // (선택) 콘솔 확인 유지
        console.log("[kw save]", kwList, "=> ids:", ids, "inserted:", inserted);
      }

      // 매핑 갱신: 기존 삭제 → 신규 삽입
      await client.from("snack_flavors_map").delete().eq("snack_id", id);
      if (selectedFlavors.length) {
        const rows = selectedFlavors.map(fid => ({ snack_id: id, flavor_id: fid }));
        const { error: mapErr } = await client.from("snack_flavors_map").insert(rows);
        if (mapErr) throw mapErr;
      }


      router.replace(`/admin/snacks/${id}`);
    } catch (e) {
      setErr(e.message || "저장 실패");
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
          과자 종류 *
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

        <label>
          맛(복수 선택 가능)
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
        </label>

        <TagInput value={keywords} onChange={setKeywords} placeholder="예: 감자, 양파, 해물…" />

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
        input, select { padding:8px; border:1px solid #ccc; border-radius:6px; }
        .row { display:flex; gap:8px; margin-top:12px; }
        .err { color:#c00; }
        .preview img { max-width:300px; border:1px solid #ccc; border-radius:6px; margin-top:8px; }
        .chips { display:flex; flex-wrap:wrap; gap:8px; }
        .chip { display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border:1px solid #ddd; border-radius:999px; }
      `}</style>
    </section>
  );
}
