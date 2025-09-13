import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // RLS 전제면 anon으로 충분

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const typeId = searchParams.get("typeId"); // optional
    const selectedParam = searchParams.get("selected") || ""; // 쉼표구분 flavor_id들
    const op = (searchParams.get("op") || "and").toLowerCase(); // "and" | "or"

    const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    // 1) 모수 스낵: 공개 + (typeId 있으면 해당 타입만)
    let q = sb.from("snacks").select("id").eq("is_public", true).limit(10000);
    if (typeId) q = q.eq("type_id", typeId);
    const { data: snackRows, error: e1 } = await q;
    if (e1) throw e1;

    const snackIds = (snackRows || []).map((r) => r.id);
    if (!snackIds.length) {
      return new Response(JSON.stringify({ typeId, counts: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2) 선택된 맛들
    const selected = selectedParam.split(",").map((s) => s.trim()).filter(Boolean);

    // 3) eligible 스낵 집합 구하기 (AND/OR)
    let eligible = new Set(snackIds);

    if (selected.length && op === "and") {
      const { data: selMap, error: e2 } = await sb
        .from("snack_flavors_map")
        .select("snack_id, flavor_id")
        .in("snack_id", snackIds)
        .in("flavor_id", selected)
        .limit(300000);
      if (e2) throw e2;

      const have = new Map(); // snack_id -> Set<flavor_id>
      for (const r of selMap || []) {
        if (!have.has(r.snack_id)) have.set(r.snack_id, new Set());
        have.get(r.snack_id).add(r.flavor_id);
      }
      eligible = new Set(
        Array.from(have.entries())
          .filter(([, set]) => set.size === selected.length)
          .map(([snack_id]) => snack_id)
      );
    } else if (selected.length && op === "or") {
      const { data: selMap, error: e2 } = await sb
        .from("snack_flavors_map")
        .select("snack_id")
        .in("snack_id", snackIds)
        .in("flavor_id", selected)
        .limit(300000);
      if (e2) throw e2;
      eligible = new Set((selMap || []).map((r) => r.snack_id));
    }

    if (!eligible.size) {
      return new Response(JSON.stringify({ typeId, counts: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 4) eligible 스낵에서 각 flavor의 등장 수 집계
    const { data: mapRows, error: e3 } = await sb
      .from("snack_flavors_map")
      .select("flavor_id, snack_id")
      .in("snack_id", Array.from(eligible))
      .limit(500000);
    if (e3) throw e3;

    const counts = {};
    for (const r of mapRows || []) {
      if (!r.flavor_id) continue;
      counts[r.flavor_id] = (counts[r.flavor_id] || 0) + 1;
    }

    return new Response(JSON.stringify({ typeId, counts }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("available flavors error", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
