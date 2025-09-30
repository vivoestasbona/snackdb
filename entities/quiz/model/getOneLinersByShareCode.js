import { getSupabaseAdmin } from '../../../shared/api/supabaseAdmin.js';
const supabaseAdmin = getSupabaseAdmin();

export async function getOneLinersByShareCode(shareCode, { limit = 20, cursor = null } = {}) {
  if (!shareCode) throw new Error('getOneLinersByShareCode: shareCode required');

  let q = supabaseAdmin
    .from('quiz_one_liners')
    .select('id, content, created_at', { count: 'exact' })
    .eq('share_code', shareCode)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(50, limit)));

  if (cursor) {
    q = q.lt('created_at', cursor); // keyset pagination
  }

  const { data, error } = await q;
  if (error) throw new Error(`getOneLinersByShareCode error: ${error.message}`);
  return data ?? [];
}
