import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '../../../../../../../../shared/api/supabaseAdmin.js';

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
  if (!uid) return { ok:false, status:401, error:'unauthenticated' };
  const { data: prof } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).single();
  if ((prof?.role || '').toLowerCase() !== 'admin') return { ok:false, status:403, error:'forbidden' };
  return { ok:true };
}

async function getQuizBySlug(slug) {
  const { data, error } = await supabaseAdmin.from('quizzes').select('id').eq('slug', slug).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function POST(req, { params }) {
  try {
    const { slug, id } = (await params) ?? {};
    const body = await req.json().catch(() => ({}));
    const dir = (body?.direction || '').toLowerCase(); // 'up' | 'down'

    if (!slug || !id || !['up','down'].includes(dir)) {
      return NextResponse.json({ ok:false, error:'slug, id, direction required' }, { status:400 });
    }

    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ ok:false, error:auth.error }, { status:auth.status });

    const quiz = await getQuizBySlug(slug);

    // 현재 문항
    const { data: cur, error: cErr } = await supabaseAdmin
      .from('quiz_questions')
      .select('id, order_index')
      .eq('id', id).eq('quiz_id', quiz.id)
      .single();
    if (cErr) return NextResponse.json({ ok:false, error:cErr.message }, { status:404 });

    const targetOrder = dir === 'up' ? (cur.order_index - 1) : (cur.order_index + 1);
    if (targetOrder < 1) return NextResponse.json({ ok:true }); // 아무 것도 안 함

    // 이웃 문항
    const { data: nei } = await supabaseAdmin
      .from('quiz_questions')
      .select('id, order_index')
      .eq('quiz_id', quiz.id)
      .eq('order_index', targetOrder)
      .maybeSingle();
    if (!nei) return NextResponse.json({ ok:true }); // 끝에 도달

    // 간단 스왑(경쟁 상황 거의 없다는 가정)
    // 1) 이웃을 임시 -1로 이동
    await supabaseAdmin.from('quiz_questions')
      .update({ order_index: -1 })
      .eq('id', nei.id).eq('quiz_id', quiz.id);
    // 2) 현재 → targetOrder
    await supabaseAdmin.from('quiz_questions')
      .update({ order_index: targetOrder })
      .eq('id', cur.id).eq('quiz_id', quiz.id);
    // 3) 이웃 → cur.order_index
    await supabaseAdmin.from('quiz_questions')
      .update({ order_index: cur.order_index })
      .eq('id', nei.id).eq('quiz_id', quiz.id);

    return NextResponse.json({ ok:true });
  } catch (e) {
    return NextResponse.json({ ok:false, error:String(e?.message || e) }, { status:500 });
  }
}
