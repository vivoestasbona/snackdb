import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '../../../../../../shared/api/supabaseAdmin.js';

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

async function getQuizIdBySlug(slug) {
  const { data, error } = await supabaseAdmin
    .from('quizzes')
    .select('id, title')
    .eq('slug', slug)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function GET(_req, { params }) {
  try {
    const { slug } = (await params) ?? {};
    if (!slug) return NextResponse.json({ ok: false, error: 'slug required' }, { status: 400 });

    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const quiz = await getQuizIdBySlug(slug);
    const { data, error } = await supabaseAdmin
      .from('quiz_questions')
      .select('id, order_index, stimulus_image_path, hint_text, answer_key_text, response_type')
      .eq('quiz_id', quiz.id)
      .order('order_index', { ascending: true });

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, quiz: { id: quiz.id, title: quiz.title }, items: data || [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { slug } = (await params) ?? {};
    if (!slug) return NextResponse.json({ ok: false, error: 'slug required' }, { status: 400 });

    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const body = await req.json().catch(() => ({}));
    const {
      order_index,                 // 없으면 자동 계산
      stimulus_image_path,         // 업로드 API에서 받은 경로 'quiz-images/...'
      hint_text = '',
      answer_key_text = '',
      acceptable_answers = [],     // 문자열 배열
      response_type = 'text',      // MVP 고정
    } = body;

    if (!stimulus_image_path) {
      return NextResponse.json({ ok: false, error: 'stimulus_image_path required' }, { status: 400 });
    }

    const quiz = await getQuizIdBySlug(slug);

    // order_index 자동 계산
    let ord = Number(order_index);
    if (!Number.isFinite(ord)) {
      const { data: maxRow } = await supabaseAdmin
        .from('quiz_questions')
        .select('order_index')
        .eq('quiz_id', quiz.id)
        .order('order_index', { ascending: false })
        .limit(1)
        .maybeSingle();
      ord = (maxRow?.order_index || 0) + 1;
    } else {
      ord = Math.max(1, Math.floor(ord));
    }

    const payload = {
      quiz_id: quiz.id,
      order_index: ord,
      stimulus_image_path,
      hint_text,
      answer_key_text,
      acceptable_answers: Array.isArray(acceptable_answers) ? acceptable_answers : [],
      response_type,
    };

    const { data, error } = await supabaseAdmin
      .from('quiz_questions')
      .insert(payload)
      .select('id, order_index')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, item: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
