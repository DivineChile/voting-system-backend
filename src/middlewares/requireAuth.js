import { supabaseAuthClient, supabaseAdmin } from '../config/supabase.js';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Missing or invalid authorization header.',
      });
    }

    const token = authHeader.split(' ')[1];

    const { data, error } = await supabaseAuthClient.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token.',
      });
    }

    const authUser = data.user;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        auth_user_id,
        full_name,
        email,
        matric_no,
        department,
        role,
        is_eligible,
        is_active,
        created_at
      `)
      .eq('auth_user_id', authUser.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found for authenticated user.',
      });
    }

    req.authUser = authUser;
    req.profile = profile;
    req.accessToken = token;

    next();
  } catch (error) {
    console.error('requireAuth error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication middleware failed.',
    });
  }
}