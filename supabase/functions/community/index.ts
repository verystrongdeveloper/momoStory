import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { createCommunityHandler } from './handler.ts';
import assets from '../../../shared/community/assets.json' with { type: 'json' };

const url = Deno.env.get('SUPABASE_URL')!;
// Service key lives exclusively in the Supabase function environment, never in Expo env vars.
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
Deno.serve(createCommunityHandler({
  assets,
  authenticate: async token => {
    const { data, error } = await admin.auth.getUser(token);
    return error ? null : data.user?.id ?? null;
  },
  rpc: async (actor, action, data) => action === 'list'
    ? admin.rpc('community_list', { p_actor: actor, p_data: data })
    : admin.rpc('community_api', { p_actor: actor, p_action: action, p_data: data }),
}));
