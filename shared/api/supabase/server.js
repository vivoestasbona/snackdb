// shared/api/supabase/server.js
import { createClient } from "@supabase/supabase-js";

export function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env not set");
  return createClient(url, key, {
    auth: {
      persistSession: false,     // 서버는 세션 저장 X
      autoRefreshToken: false,
    },
  });
}
