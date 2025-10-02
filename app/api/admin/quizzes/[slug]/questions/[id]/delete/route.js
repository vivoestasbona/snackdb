import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '../../../../../../../../shared/api/supabaseAdmin.js';

const supabaseAdmin = getSupabaseAdmin();

async function requireAdmin() {
  const cookieStore = await cookies(); // Next15: await 필요
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

export async function POST(_req, { params }) {
  try {
    const { slug, id } = (await params) ?? {};
    if (!slug || !id) return NextResponse.json({ ok:false, error:'slug and id required' }, { status:400 });

    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ ok:false, error:auth.error }, { status:auth.status });

    const quiz = await getQuizBySlug(slug);

    // 대상 문항 조회 (order_index 확보)
    const { data: q, error: qErr } = await supabaseAdmin
      .from('quiz_questions')
      .select('id, order_index')
      .eq('id', id)
      .eq('quiz_id', quiz.id)
      .single();
    if (qErr) return NextResponse.json({ ok:false, error:qErr.message }, { status:404 });

    // 1) 삭제
    const { error: dErr } = await supabaseAdmin
      .from('quiz_questions')
      .delete()
      .eq('id', id)
      .eq('quiz_id', quiz.id);
    if (dErr) return NextResponse.json({ ok:false, error:dErr.message }, { status:500 });

    // 2) 자동 재인덱싱: 뒤 번호들을 -1
    const { error: uErr } = await supabaseAdmin
      .rpc('decrement_order_after_delete', { p_quiz_id: quiz.id, p_deleted_order: q.order_index })
      .select();
    // ↑ 만약 RPC가 없다면 아래 주석 방식으로 대체:
    // const { error: uErr } = await supabaseAdmin
    //   .from('quiz_questions')
    //   .update({ order_index: supabaseAdmin.rpc('sql', 'order_index - 1') }) // RPC가 없다면 raw SQL 필요
    //   .gt('order_index', q.order_index)
    //   .eq('quiz_id', quiz.id);

    if (uErr) {
      // RPC가 없거나 실패했어도 삭제 자체는 성공이라 경고만 반환
      return NextResponse.json({ ok:true, warn:'reindex_failed' });
    }

    return NextResponse.json({ ok:true });
  } catch (e) {
    return NextResponse.json({ ok:false, error:String(e?.message || e) }, { status:500 });
  }
}
