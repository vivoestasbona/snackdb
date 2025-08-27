// features/snack-create/model/uploadFileToStorage.js
import { getSupabaseClient } from "@shared/api/supabase/browser";

/** 확장자 결정 */
function extFromType(type) {
  return type === "image/jpeg" ? "jpg"
       : type === "image/png"  ? "png"
       : type === "image/webp" ? "webp"
       : type === "image/gif"  ? "gif"
       : "bin";
}

/** 간단 랜덤명 */
function cryptoRandom() {
  const a = globalThis.crypto?.getRandomValues?.(new Uint32Array(4));
  return a ? Array.from(a, x => x.toString(16).padStart(8, "0")).join("") : String(Date.now());
}

/** 스토리지 업로드 후 path 반환 (비공개 버킷) */
export async function uploadFileToStorage({ file, userId }) {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
    throw new Error("지원되지 않는 이미지 형식입니다. (jpeg/png/webp/gif)");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("이미지 크기는 최대 5MB입니다.");
  }
  const client = getSupabaseClient();
  const path = `${userId}/${cryptoRandom()}.${extFromType(file.type)}`;
  const { error } = await client.storage.from("snack-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}
