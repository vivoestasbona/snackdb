"use client";
import { getSupabaseClient } from "@shared/api/supabaseClient";

export async function getSnackFlavors() {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("snack_flavors")
    .select("id, name, slug, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message || "snack_flavors 조회 실패");
  return data || [];
}
