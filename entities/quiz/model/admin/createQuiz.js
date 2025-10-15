import { getSupabaseAdmin } from '../../../../shared/api/supabaseAdmin.js';
const supabaseAdmin = getSupabaseAdmin();

/**
 * 관리자 권한으로 퀴즈 메타(제목/슬러그 등) 생성
 */
export async function createQuiz({
  title,
  slug,
  description = '',
  visibility = 'public',     // 'public' | 'unlisted'
  is_published = false,
  template = 'photo_guess',  // MVP 고정
  response_type = 'text',    // MVP 고정
}) {
  if (!title) throw new Error('title required');
  if (!slug) throw new Error('slug required');

  const payload = {
    title,
    slug,
    description,
    visibility,
    is_published,
    template,
    response_type,
    status: is_published ? 'published' : 'draft',
  };

  const { data, error } = await supabaseAdmin
    .from('quizzes')
    .insert(payload)
    .select('id, slug, title')
    .single();

  if (error) throw new Error(`createQuiz error: ${error.message}`);
  return data; // { id, slug, title }
}
