import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '../../../../../shared/api/supabaseAdmin.js';

const supabaseAdmin = getSupabaseAdmin();

async function requireAdmin() {
  const cookieStore = await cookies(); // Next 15
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { get: (n) => cookieStore.get(n)?.value, set(){}, remove(){} } }
  );
  const { data } = await supa.auth.getUser();
  const uid = data?.user?.id;
  if (!uid) return { ok:false, status:401, error:'unauthenticated' };
  const { data: prof } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).single();
  if ((prof?.role || '').toLowerCase() !== 'admin') return { ok:false, status:403, error:'forbidden' };
  return { ok:true };
}

async function getQuizBySlug(slug) {
  const { data, error } = await supabaseAdmin.from('quizzes').select('id, slug, title').eq('slug', slug).single();
  if (error) throw new Error(error.message);
  return data;
}

// 제목 변경(필요 시 설명 등 확장 가능)
export async function PATCH(req, { params }) {
  try {
    const { slug } = (await params) ?? {};
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ ok:false, error:auth.error }, { status:auth.status });

    const body = await req.json().catch(() => ({}));
    const { title, description } = body;
    if (!title && typeof description !== 'string') {
      return NextResponse.json({ ok:false, error:'nothing to update' }, { status:400 });
    }

    const quiz = await getQuizBySlug(slug);
    const payload = {};
    if (typeof title === 'string') payload.title = title;  
    if (typeof description === 'string') payload.description = description;

    const { error } = await supabaseAdmin.from('quizzes').update(payload).eq('id', quiz.id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok:true });
  } catch (e) {
    return NextResponse.json({ ok:false, error:String(e?.message || e) }, { status:500 });
  }
}

// 세트 삭제(옵션: 스토리지 파일도 같이 삭제)
export async function DELETE(req, { params }) {
  try {
    const { slug } = (await params) ?? {};
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ ok:false, error:auth.error }, { status:auth.status });

    const url = new URL(req.url);
    const withAssets = url.searchParams.get('with_assets') === '1';

    const quiz = await getQuizBySlug(slug);

    // 1) 퀴즈 삭제 (quiz_questions는 FK ON DELETE CASCADE 가정)
    const { error: delErr } = await supabaseAdmin.from('quizzes').delete().eq('id', quiz.id);
    if (delErr) throw new Error(delErr.message);

    // 2) 선택: 스토리지 자산 정리 (경로: quiz-images/<slug>/*)
    if (withAssets) {
      const bucket = supabaseAdmin.storage.from('quiz-images');
      const { data: list } = await bucket.list(slug); // 하위에 폴더 안 쓰는 구조 가정
      if (Array.isArray(list) && list.length) {
        const paths = list.map(obj => `${slug}/${obj.name}`);
        await bucket.remove(paths);
      }
    }

    return NextResponse.json({ ok:true });
  } catch (e) {
    return NextResponse.json({ ok:false, error:String(e?.message || e) }, { status:500 });
  }
}
