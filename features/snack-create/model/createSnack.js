// features/snack-create/model/createSnack.js
import { getSupabaseClient } from "@shared/api/supabase/browser";

export async function createSnack({ name, brand, imagePath, userId }) {
  const client = getSupabaseClient();
  const n = (name || "").trim();
  const b = (brand || "").trim();

  if (!n) throw new Error("이름은 필수입니다.");
  if (n.length > 80) throw new Error("이름은 80자 이하로 입력하세요.");
  if (b.length > 80) throw new Error("브랜드는 80자 이하로 입력하세요.");
  if (!imagePath) throw new Error("이미지 업로드에 실패했습니다.");

  const { error } = await client.from("snacks").insert([{
    name: n,
    brand: b || null,
    image_path: imagePath,
    created_by: userId,
  }]);

  if (error) {
    if (error.code === "23505") throw new Error("이미 동일한 이름/브랜드의 과자가 있습니다.");
    throw new Error(error.message || "저장 실패");
  }
}
