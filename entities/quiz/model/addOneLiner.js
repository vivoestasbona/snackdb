import { getSupabaseAdmin } from '../../../shared/api/supabaseAdmin.js';
const supabaseAdmin = getSupabaseAdmin();

export async function addOneLiner({ shareCode, content }) {
  if (!shareCode) throw new Error('addOneLiner: shareCode required');
  const text = String(content ?? '').trim();
  if (text.length < 1 || text.length > 200) {
    throw new Error('addOneLiner: content length 1..200');
  }

  // share_code → quiz_id
  const { data: attempt, error: aErr } = await supabaseAdmin
    .from('quiz_attempts')
    .select('quiz_id')
    .eq('share_code', shareCode)
    .single();
  if (aErr) throw new Error(`addOneLiner attempt error: ${aErr.message}`);

  const { data, error } = await supabaseAdmin
    .from('quiz_one_liners')
    .insert({ quiz_id: attempt.quiz_id, share_code: shareCode, content: text })
    .select('id, content, created_at')
    .single();
  if (error) throw new Error(`addOneLiner insert error: ${error.message}`);

  return data;
}
