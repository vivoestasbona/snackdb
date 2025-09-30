import { NextResponse } from 'next/server';
import { addOneLiner } from '../../../../entities/quiz/model/addOneLiner.js';
import { getOneLinersByShareCode } from '../../../../entities/quiz/model/getOneLinersByShareCode.js';
import { getResultByShareCode } from '../../../../entities/quiz/model/getResultByShareCode.js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '../../../../shared/api/supabaseAdmin.js';

const supabaseAdmin = getSupabaseAdmin();

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const limit = Number(searchParams.get('limit') || '20');
    const cursor = searchParams.get('cursor'); // ISO string
    if (!code) return NextResponse.json({ ok: false, error: 'code required' }, { status: 400 });

    // 내 유저 ID (있으면 본인 댓글 삭제 버튼 노출)
    const cookieStore = cookies();
    const supa = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { get: (n) => cookieStore.get(n)?.value, set(){}, remove(){} } }
    );
    const { data: userData } = await supa.auth.getUser();
    const myUserId = userData?.user?.id ?? null;
    // 내 role 조회 (admin client로 안전하게 1건 조회)
    let isAdmin = false;
    if (myUserId) {
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', myUserId)
        .single();
      isAdmin = String(prof?.role || '').toLowerCase() === 'admin'; // 대소문자 안전
    }

    // 1) 댓글 원본
    const rows = await getOneLinersByShareCode(code, { limit, cursor });

    // 2) 작성자명 맵
    const authorIds = Array.from(new Set(rows.map(r => r.author_id).filter(Boolean)));
    let nameMap = {};
    if (authorIds.length > 0) {
      const { data: profiles, error: pErr } = await supabaseAdmin
        .from('profiles')
        .select('id, display_name')
        .in('id', authorIds);
      if (!pErr && Array.isArray(profiles)) {
        nameMap = Object.fromEntries(profiles.map(p => [p.id, p.display_name || '']));
      }
    }

    // 3) 점수(이 결과 페이지의 share_code 점수)
    const result = await getResultByShareCode(code).catch(() => null);
    const total_correct = result?.total_correct ?? null;
    const total_questions = result?.total_questions ?? null;

    // 4) 합성 응답
    const items = rows.map(r => ({
      id: r.id,
      content: r.content,
      created_at: r.created_at,
      author_display_name: r.author_id ? (nameMap[r.author_id] || '익명') : '익명',
      total_correct,
      total_questions,
      can_delete: isAdmin || !!(myUserId && r.author_id === myUserId),
    }));

    return NextResponse.json({ ok: true, can_post: !!myUserId, items });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { code, content } = body;
    if (!code) return NextResponse.json({ ok: false, error: 'code required' }, { status: 400 });
    // 요청 쿠키로 SSR 클라이언트 생성 → 현재 로그인 사용자 "필수"
    const cookieStore = cookies();
    const supa = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get: (name) => cookieStore.get(name)?.value,
          // Route Handler에서는 set/remove는 필수 아님(세션 갱신 시 필요) — no-ops로 둬도 OK
          set: () => {},
          remove: () => {},
        },
      }
    );
    const { data: userData } = await supa.auth.getUser();
    const authorId = userData?.user?.id ?? null;
    if (!authorId) {
      return NextResponse.json({ ok: false, error: 'login required' }, { status: 401 });
    }

    const row = await addOneLiner({ shareCode: code, content, authorId });

    // 작성 직후 응답도 표시용 필드를 합성해 돌려주기
    let author_display_name = '익명';
    const { data: p } = await supabaseAdmin
      .from('profiles')
      .select('display_name')
      .eq('id', authorId)
      .single();
    author_display_name = p?.display_name || '익명';
    
    const result = await getResultByShareCode(code).catch(() => null);
    const total_correct = result?.total_correct ?? null;
    const total_questions = result?.total_questions ?? null;

    return NextResponse.json({
      ok: true,
      item: {
        id: row.id,
        content: row.content,
        created_at: row.created_at,
        author_display_name,
        total_correct,
        total_questions,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
