// lib/supabaseClient.js
"use client";

import { createClient } from "@supabase/supabase-js";

let cached = null; // 현재 선택된 remember 모드의 클라이언트

function readRememberFlag() {
  // 사용자가 마지막으로 선택한 모드(초기값: 유지 ON)
  if (typeof window === "undefined") return true;
  const v = window.localStorage.getItem("snackdb_remember");
  return v === null ? true : v === "1";
}

export function getSupabaseClient(opts = {}) {
  if (typeof window === "undefined") return null;

  // 우선순위: 명시 옵션 > 저장된 플래그
  const remember = typeof opts.remember === "boolean" ? opts.remember : readRememberFlag();
  const storage = remember ? window.localStorage : window.sessionStorage;

  // 같은 모드면 재사용
  if (cached && cached._remember === remember) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const client = createClient(url, key, {
    auth: {
      // 중요: 항상 true로 두고, 저장소만 바꾼다
      persistSession: true,
      storage,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  client._remember = remember;
  cached = client;
  return client;
}
