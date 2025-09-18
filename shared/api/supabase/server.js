// shared/api/supabase/server.js
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getSupabaseServer() {  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env not set");
  const cookieStore = await cookies();
 return createServerClient(url, key, {
   cookies: {
     get: (name) => cookieStore.get(name)?.value,
      // Next 15에서는 비동기도 허용 – 런타임별 예외 방지용으로 try/catch
      set: async (name, value, options) => { try { cookieStore.set({ name, value, ...options }); } catch {} },
      remove: async (name, options) => {
        try { cookieStore.delete?.({ name, ...options }); } catch { try { cookieStore.set({ name, value: "", ...options }); } catch {} }
      },
   },
 });
}
