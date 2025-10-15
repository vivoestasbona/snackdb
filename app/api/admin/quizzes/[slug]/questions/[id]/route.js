import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '../../../../../../../shared/api/supabaseAdmin.js';

const supabaseAdmin = getSupabaseAdmin();

async function requireAdmin() {
  const cookieStore = await cookies();
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { get: (n) => cookieStore.get(n)?.value, set(){}, remove(){} } }
  );
  const { data: userData } = await supa.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return { ok: false, status: 401, error: 'unauthenticated' };
  const { data: prof } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).single();
  if ((prof?.role || '').toLowerCase() !== 'admin') return { ok: false, status: 403, error: 'forbidden' };
  return { ok: true };
}

async function getQuizBySlug(slug) {
  const { data, error } = await supabaseAdmin
    .from('quizzes')
    .select('id')
    .eq('slug', slug)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function PATCH(req, { params }) {
  try {
    const { slug, id } = (await params) ?? {};
    if (!slug || !id) return NextResponse.json({ ok:false, error:'slug and id required' }, { status:400 });

    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ ok:false, error:auth.error }, { status:auth.status });

    const quiz = await getQuizBySlug(slug);

    const body = await req.json().catch(() => ({}));
    const payload = {};
    if (typeof body.hint_text === 'string') payload.hint_text = body.hint_text;
    if (typeof body.answer_key_text === 'string') payload.answer_key_text = body.answer_key_text;
    if (Array.isArray(body.acceptable_answers)) payload.acceptable_answers = body.acceptable_answers;
    if (typeof body.stimulus_image_path === 'string') payload.stimulus_image_path = body.stimulus_image_path;
    if (typeof body.response_type === 'string') payload.response_type = body.response_type; // 향후 확장용

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ ok:false, error:'no payload' }, { status:400 });
    }

    const { data, error } = await supabaseAdmin
      .from('quiz_questions')
      .update(payload)
      .eq('id', id)
      .eq('quiz_id', quiz.id)
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok:true, id: data.id });
  } catch (e) {
    return NextResponse.json({ ok:false, error:String(e?.message || e) }, { status:500 });
  }
}
