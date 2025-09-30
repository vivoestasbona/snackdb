import { NextResponse } from 'next/server';
import { addOneLiner } from '../../../../entities/quiz/model/addOneLiner.js';
import { getOneLinersByShareCode } from '../../../../entities/quiz/model/getOneLinersByShareCode.js';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const limit = Number(searchParams.get('limit') || '20');
    const cursor = searchParams.get('cursor'); // ISO string
    if (!code) return NextResponse.json({ ok: false, error: 'code required' }, { status: 400 });

    const rows = await getOneLinersByShareCode(code, { limit, cursor });
    return NextResponse.json({ ok: true, items: rows });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { code, content } = body;
    if (!code) return NextResponse.json({ ok: false, error: 'code required' }, { status: 400 });

    const row = await addOneLiner({ shareCode: code, content });
    return NextResponse.json({ ok: true, item: row });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
