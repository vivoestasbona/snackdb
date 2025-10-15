import { NextResponse } from 'next/server';
import { createQuiz } from '../../../../entities/quiz/model/admin/createQuiz.js';

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      title,
      slug,
      description = '',
      visibility = 'public',
      is_published = false,
      template = 'photo_guess',
      response_type = 'text',
    } = body;

    const row = await createQuiz({
      title,
      slug,
      description,
      visibility: ['public','unlisted'].includes(visibility) ? visibility : 'public',
      is_published: !!is_published,
      template,
      response_type,
    });

    return NextResponse.json({ ok: true, id: row.id, slug: row.slug });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 400 });
  }
}
