import { createClient } from '@supabase/supabase-js';
import env from './env.js';

const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey);
const supabaseAuthClient = createClient(env.supabaseUrl, env.supabaseAnonKey);

export { supabaseAdmin, supabaseAuthClient };