import supabaseAdmin from '../../../shared/api/supabaseAdmin.js';
// ↑ export 명이 다르면 여기를 수정하세요. (예: { supabaseAdmin } 등)

export async function getQuizPublicBySlug(slug) {
  if (!slug) throw new Error('getQuizPublicBySlug: slug is required');

  const { data, error } = await supabaseAdmin
    .from('quizzes')
    .select(
      id, slug, title, description,
      template, template_config,
      status, visibility, requires_login, published_at
    )
    .eq('slug', slug)
    .eq('status', 'published')
    .in('visibility', ['public','unlisted'])
    .single();

  if (error) throw error;
  return data; // { id, slug, title, ... }
}
