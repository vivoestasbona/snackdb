// app/api/metrics/login-prompt/route.js
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req) {
  const sb = getSupabaseAdmin();
  const body = await req.json().catch(() => ({}));
  const { event = "prompt", from, path, reason, snackId, reviewId } = body || {};

  const { error } = await sb.from("login_prompt_events").insert({
    event,
    from,
    path,
    reason,
    snack_id: snackId ?? null,
    review_id: reviewId ?? null,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
