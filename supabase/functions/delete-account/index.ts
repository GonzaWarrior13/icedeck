// IceDeck account deletion; deploy to Supabase as an Edge Function.
// Never put the service-role key in Vite/browser environment variables.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Content-Type': 'application/json',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const token = /^Bearer (.+)$/i.exec(req.headers.get('authorization') || '')?.[1];
  if (!token) return json({ error: 'Authentication required' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !serviceKey) return json({ error: 'Function not configured' }, 503);

  const publicClient = createClient(url, anon);
  const { data: { user }, error: verifyError } = await publicClient.auth.getUser(token);
  if (verifyError || !user) return json({ error: 'Invalid or expired session' }, 401);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  // teams.created_by is an FK to auth.users, and a team must not become orphaned.
  const { data: owned, error: ownershipError } = await admin.from('teams')
    .select('id,name').eq('created_by', user.id).limit(1);
  if (ownershipError) return json({ error: 'Unable to verify team ownership' }, 500);
  if (owned?.length) return json({
    error: 'Transfer ownership of your teams to another member before deleting your account.',
  }, 409);

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return json({ error: 'Could not delete account: ' + deleteError.message }, 500);
  return json({ deleted: true });
});
