// entities/quiz/model/getQuizPublicBySlug.js
import { getSupabaseAdmin } from '../../../shared/api/supabaseAdmin.js';
const supabaseAdmin = getSupabaseAdmin();

/**
 * 공개 가능한 퀴즈(발행 + public/unlisted) 메타를 slug로 1건 조회
 * 정답 등 민감 컬럼은 포함하지 않음
 */
export async function getQuizPublicBySlug(slug) {
  if (!slug) throw new Error('getQuizPublicBySlug: slug is required');

  const { data, error } = await supabaseAdmin
    .from('quizzes')
    .select(
      'id, slug, title, description, template, template_config, status, visibility, requires_login, published_at'
    )
    .eq('slug', slug)
    .eq('status', 'published')
    .in('visibility', ['public', 'unlisted'])
    .maybeSingle(); // 없으면 null, 있으면 1건

  if (error) throw new Error(`getQuizPublicBySlug supabase error: ${error.message}`);
  return data; // null | { id, slug, ... }
}
