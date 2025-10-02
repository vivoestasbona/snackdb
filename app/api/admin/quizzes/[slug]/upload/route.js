import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '../../../../../../shared/api/supabaseAdmin.js';

const supabaseAdmin = getSupabaseAdmin();

// 간단 관리자 체크
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

export async function POST(req, { params }) {
  try {
    const { slug } = (await params) ?? {};
    if (!slug) return NextResponse.json({ ok: false, error: 'slug required' }, { status: 400 });

    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const fd = await req.formData();
    const file = fd.get('file');
    const order = String(fd.get('order') || '').trim();
    if (!file || typeof file === 'string') {
      return NextResponse.json({ ok: false, error: 'file required' }, { status: 400 });
    }

    const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const safeOrder = (order || '').toString().replace(/[^a-z0-9_-]/gi, '');
    // ✅ order가 없으면 항상 고유 키 사용(시간+랜덤)
    const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
    const base = safeOrder ? `q-${safeOrder}` : `q-${unique}`;
    const objectPath = `${slug}/${base}.${ext}`;

    const buf = Buffer.from(await file.arrayBuffer());
    const { data, error } = await supabaseAdmin
      .storage.from('quiz-images')
      .upload(objectPath, buf, { upsert: true, contentType: file.type || undefined });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // DB에 저장할 경로는 프로젝트에서 쓰던 규칙 유지: 'quiz-images/<...>'
    const storagePath = `quiz-images/${data?.path || objectPath}`;
    return NextResponse.json({ ok: true, path: storagePath });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
