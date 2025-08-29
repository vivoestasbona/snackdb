// features/snack-create/model/createSnack.js
import { getSupabaseClient } from "@shared/api/supabase/browser";

export async function createSnack({ name, brand, imagePath, userId, typeId }) {
  const client = getSupabaseClient();
  const n = (name || "").trim();
  const b = (brand || "").trim();

  if (!n) throw new Error("이름은 필수입니다.");
  if (!imagePath) throw new Error("이미지 업로드에 실패했습니다.");
  if (!typeId) throw new Error("과자 종류를 선택해 주세요.");

  // insert + id 반환
  const { data, error } = await client
    .from("snacks")
    .insert([{
      name: n,
      brand: b || null,
      image_path: imagePath,
      created_by: userId,
      type_id: typeId,
      is_public: false      // 필요시 기본 비공개
    }])
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("이미 동일한 이름/브랜드의 과자가 있습니다.");
    throw new Error(error.message || "저장 실패");
  }
  return data.id; // ★ 새로 추가
}
