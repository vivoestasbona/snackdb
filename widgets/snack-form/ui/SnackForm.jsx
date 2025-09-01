// widgets/snack-form/ui/SnackForm.jsx
"use client";

import { useEffect, useState } from "react";
import TypeSelect from "@features/manage-snack-categories/ui/TypeSelect";
import FlavorChipsSelector from "@features/manage-snack-categories/ui/FlavorChipsSelector";
import TagInput from "@features/keywords/ui/TagInput";
import { ensureKeywords } from "@features/keywords/model/ensureKeywords";
import { mapKeywords } from "@features/keywords/model/mapKeywords";
import { uploadFileToStorage } from "@features/snack-create/model/uploadFileToStorage";
import { createSnack } from "@features/snack-create/model/createSnack";
import { getSupabaseClient } from "@shared/api/supabaseClient";

export default function SnackForm({
  mode = "create",                // "create" | "edit"
  initial = null,                 // edit용 초기값
  onDone,                         // 완료 후 콜백 (id 반환 가능)
}) {
  const sb = getSupabaseClient();

  const [name, setName] = useState(initial?.name || "");
  const [brand, setBrand] = useState(initial?.brand || "");
  const [typeId, setTypeId] = useState(initial?.typeId ?? "");
  const [flavorIds, setFlavorIds] = useState(initial?.flavorIds || []);
  const [tags, setTags] = useState(initial?.tags || []);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(initial?.imageUrl || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // preview
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setErr("");

    try {
      const { data: s } = await sb.auth.getSession();
      const user = s?.session?.user;
      if (!user) throw new Error("로그인이 필요합니다.");

      if (!typeId) throw new Error("과자 종류를 선택해 주세요.");

      let imagePath = initial?.imagePath || null;
      if (mode === "create") {
        if (!file) throw new Error("이미지 파일을 업로드해 주세요.");
        imagePath = await uploadFileToStorage({ file, userId: user.id });
        const snackId = await createSnack({ name, brand, imagePath, userId: user.id, typeId });

        // 맛 매핑
        if (flavorIds.length) {
          const rows = flavorIds.map(fid => ({ snack_id: snackId, flavor_id: fid }));
          const { error } = await sb.from("snack_flavors_map")
            .upsert(rows, { onConflict: "snack_id,flavor_id", ignoreDuplicates: true });
          if (error) throw error;
        }

        // 태그(있다면)
        if (tags.length) {
          const kwIds = await ensureKeywords(tags);
          await mapKeywords(snackId, kwIds);
        }

        onDone?.(snackId);
      } else {
        // edit
        const snackId = initial.id;
        // 본문
        const up1 = await sb.from("snacks").update({
          name, brand, type_id: typeId
        }).eq("id", snackId);
        if (up1.error) throw up1.error;

        // 새 파일이 있으면 업로드 후 이미지 교체(선택)
        if (file) {
          const newPath = await uploadFileToStorage({ file, userId: user.id });
          const up2 = await sb.from("snacks").update({ image_path: newPath }).eq("id", snackId);
          if (up2.error) throw up2.error;
        }

        // 맛 리셋 후 재적용
        await sb.from("snack_flavors_map").delete().eq("snack_id", snackId);
        if (flavorIds.length) {
          const rows = flavorIds.map(fid => ({ snack_id: snackId, flavor_id: fid }));
          const ins = await sb.from("snack_flavors_map").insert(rows);
          if (ins.error) throw ins.error;
        }

        // 태그 리셋 후 재적용
        await sb.from("snack_keywords_map").delete().eq("snack_id", snackId);
        if (tags.length) {
          const kwIds = await ensureKeywords(tags);
          await mapKeywords(snackId, kwIds);
        }

        onDone?.(snackId);
      }
    } catch (e) {
      setErr(e.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label>이름*<input value={name} onChange={e=>setName(e.target.value)} required maxLength={80} /></label>
      <label>브랜드<input value={brand} onChange={e=>setBrand(e.target.value)} maxLength={80} /></label>

      <TypeSelect value={typeId} onChange={setTypeId} />

      <FlavorChipsSelector value={flavorIds} onChange={setFlavorIds} />

      <label className="block">
        이미지 {mode === "create" ? "업로드*" : "(바꾸려면 선택)"}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif"
               onChange={(e)=>setFile(e.target.files?.[0] || null)} required={mode==="create"} />
      </label>

      {preview && <div className="preview"><img src={preview} alt="미리보기" /></div>}

      {/* 태그 입력 – 필요 시 주석 해제
      <TagInput value={tags} onChange={setTags} />
      */}

      <div className="row">
        <button type="submit" disabled={saving || !name.trim() || !typeId}>
          {saving ? "저장 중..." : (mode === "create" ? "등록" : "수정")}
        </button>
        {err && <span className="err">{err}</span>}
      </div>

      <style jsx>{`
        .form { display:grid; gap:12px; }
        label { display:grid; gap:6px; font-size:14px; }
        input[type="text"], input[type="file"], select {
          padding:10px 12px; border:1px solid #ddd; border-radius:8px; font-size:14px;
        }
        .preview img { width: 260px; height: 160px; object-fit: cover; border:1px solid #eee; border-radius:8px; }
        .row { display:flex; gap:10px; align-items:center; }
        button { padding:10px 14px; border:none; border-radius:8px; background:#222; color:#fff; cursor:pointer; }
        .err { color:#c00; font-size:13px; }
      `}</style>
    </form>
  );
}
