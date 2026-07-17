// delete-account — App Store Guideline 5.1.1(v) in-app account deletion.
//
// The caller's identity comes EXCLUSIVELY from the verified JWT (auth.getUser
// under the caller's Authorization header) — never from the request body, so
// no caller can delete anyone but themselves. The service-role client then
// removes the auth user; every user-owned row cascades from there (all four
// auth.users FKs are ON DELETE CASCADE: classrooms 002:9, behaviors 002:12,
// user_sound_settings 007:7, layout_presets 008:81; students/transactions/
// seating cascade transitively via classrooms). Default behaviors have
// user_id NULL and survive.
//
// Deployed with verify_jwt (config.toml [functions.delete-account]) so the
// platform rejects unauthenticated calls before this code runs; the in-code
// checks are belt-and-suspenders for local serving.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'method not allowed' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json(401, { error: 'missing authorization' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return json(401, { error: 'invalid session' });
  }

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('[delete-account] deleteUser failed:', deleteError.message);
    return json(500, { error: 'account deletion failed' });
  }

  return json(200, { success: true });
});
