// shared/api/supabase/browser.js
"use client";
import { createClient } from "@supabase/supabase-js";

let cached = null;

function readRememberFlag() {
  if (typeof window === "undefined") return true;
  const v = window.localStorage.getItem("snackdb_remember");
  return v === null ? true : v === "1";
}

export function getSupabaseClient(opts = {}) {
  if (typeof window === "undefined") return null;

  const remember = typeof opts.remember === "boolean" ? opts.remember : readRememberFlag();
  const storage = remember ? window.localStorage : window.sessionStorage;

  if (cached && cached._remember === remember) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const client = createClient(url, key, {
    auth: {
      persistSession: true,      // 브라우저는 세션 유지
      storage,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  client._remember = remember;
  cached = client;
  return client;
}

// 선택: 별칭도 제공(원하면 나중에 getSupabaseBrowser만 노출해도 됨)
export const getSupabaseBrowser = getSupabaseClient;
