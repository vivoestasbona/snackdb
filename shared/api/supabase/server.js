// shared/api/supabase/server.js
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env not set");
  const cookieStore = cookies();
 return createServerClient(url, key, {
   cookies: {
     get: (name) => cookieStore.get(name)?.value,
     set: (name, value, options) => cookieStore.set({ name, value, ...options }),
     remove: (name, options) => cookieStore.set({ name, value: "", ...options }),
   },
 });
}
