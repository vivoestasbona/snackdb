"use client";
import { getSupabaseClient } from "@shared/api/supabaseClient";

export async function searchKeywords(q) {
  const client = getSupabaseClient();
  if (!client || !q?.trim()) return [];
  const { data, error } = await client
    .from("snack_keywords")
    .select("id,name,slug,usage_count")
    .eq("is_active", true)
    .ilike("name", `%${q.trim()}%`)
    .order("usage_count", { ascending: false })
    .order("name", { ascending: true })
    .limit(10);
  return error ? [] : data;
}
