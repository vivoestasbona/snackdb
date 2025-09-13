import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const selectedParam = searchParams.get("selected") || "";
    const op = (searchParams.get("op") || "and").toLowerCase(); // "and" | "or"

    const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    // 0) 전체 공개 스낵(타입 포함)
    const { data: snackRows, error: e0 } = await sb
      .from("snacks")
      .select("id, type_id")
      .eq("is_public", true)
      .limit(10000);
    if (e0) throw e0;
    if (!snackRows?.length) {
      return new Response(JSON.stringify({ counts: {} }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const allSnackIds = snackRows.map((r) => r.id);
    const snackIdToType = new Map(snackRows.map((r) => [r.id, r.type_id]));

    // 1) 선택된 맛
    const selected = selectedParam.split(",").map((s) => s.trim()).filter(Boolean);

    // 2) eligible 스낵 집합 (선택 맛 AND/OR)
    let eligible = new Set(allSnackIds);

    if (selected.length && op === "and") {
      const { data: mapRows, error: e1 } = await sb
        .from("snack_flavors_map")
        .select("snack_id, flavor_id")
        .in("snack_id", allSnackIds)
        .in("flavor_id", selected)
        .limit(300000);
      if (e1) throw e1;

      const have = new Map(); // snack_id -> Set<flavor_id>
      for (const r of mapRows || []) {
        if (!have.has(r.snack_id)) have.set(r.snack_id, new Set());
        have.get(r.snack_id).add(r.flavor_id);
      }
      eligible = new Set(
        Array.from(have.entries())
          .filter(([, set]) => set.size === selected.length)
          .map(([snack_id]) => snack_id)
      );
    } else if (selected.length && op === "or") {
      const { data: mapRows, error: e1 } = await sb
        .from("snack_flavors_map")
        .select("snack_id")
        .in("snack_id", allSnackIds)
        .in("flavor_id", selected)
        .limit(300000);
      if (e1) throw e1;
      eligible = new Set((mapRows || []).map((r) => r.snack_id));
    }

    if (!eligible.size) {
      return new Response(JSON.stringify({ counts: {} }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // 3) eligible 스낵들의 type 분포 집계
    const counts = {};
    for (const snackId of eligible) {
      const t = snackIdToType.get(snackId);
      if (!t) continue;
      counts[t] = (counts[t] || 0) + 1;
    }

    return new Response(JSON.stringify({ counts }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("available types error", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
