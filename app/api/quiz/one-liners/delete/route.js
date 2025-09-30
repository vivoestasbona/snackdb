import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '../../../../../shared/api/supabaseAdmin.js';

const supabaseAdmin = getSupabaseAdmin();

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id } = body;
    if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

    // 요청 쿠키로 로그인 유저 식별
    const cookieStore = await cookies();
    const supa = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get: (name) => cookieStore.get(name)?.value,
          set: () => {},
          remove: () => {},
        },
      }
    );
    const { data: userData } = await supa.auth.getUser();
    const user = userData?.user || null;
    const userId = user?.id ?? null;
     if (!userId) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
    
    // 내 role 조회
    let isAdmin = false;
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    isAdmin = (prof?.role === 'admin');

    // 대상 댓글 가져와서 본인 소유인지 확인
    const { data: row, error: rErr } = await supabaseAdmin
      .from('quiz_one_liners')
      .select('id, author_id, is_hidden')
      .eq('id', id)
      .single();
    if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });
    if (!row) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });

    if (row.author_id !== userId && !isAdmin) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    // 소프트 삭제(숨김)
    const { error: uErr } = await supabaseAdmin
      .from('quiz_one_liners')
      .update({ is_hidden: true })
      .eq('id', id);
    if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
