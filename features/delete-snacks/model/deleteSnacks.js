import { getSupabaseClient } from "@shared/api/supabaseClient";

/** ids: string | string[]  모두 허용 */
export async function deleteSnacks(ids) {
  const arr = Array.isArray(ids) ? ids : [ids];
  if (!arr.length) return;

  const sb = getSupabaseClient();
  const { data: sess } = await sb.auth.getSession();
  const token = sess?.session?.access_token || null;

  const res = await fetch("/api/admin/snacks/bulk", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ids: arr }),
  });

  if (!res.ok) {
    let msg = "삭제 실패";
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return (await res.json())?.deleted ?? arr;
}
