"use client";
import { getSupabaseClient } from "@shared/api/supabaseClient";

export async function mapKeywords(snackId, keywordIds = []) {
  if (!snackId || !keywordIds.length) return;
  const client = getSupabaseClient();
  const rows = keywordIds.map(id => ({ snack_id: snackId, keyword_id: id }));
  const { data, error } = await client
    .from("snack_keywords_map")
    .insert(rows)
    .select("snack_id, keyword_id"); // ← 실제로 뭐가 들어갔는지 받기
  if (error) throw error;
  return data; // 호출측에서 즉시 검증/로그 가능
 }
