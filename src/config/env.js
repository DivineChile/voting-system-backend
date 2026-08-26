import dotenv from 'dotenv';

dotenv.config();

const env = {
  port: process.env.PORT || 8080,
  frontendUrl: process.env.FRONTEND_URL,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  geminiKey: process.env.GEMINI_API_KEY,
};

if (!env.frontendUrl) {
  throw new Error('Missing FRONTEND_URL in environment variables.');
}

if (!env.supabaseUrl) {
  throw new Error('Missing SUPABASE_URL in environment variables.');
}

if (!env.supabaseAnonKey) {
  throw new Error('Missing SUPABASE_ANON_KEY in environment variables.');
}

if (!env.supabaseServiceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment variables.');
}

export default env;