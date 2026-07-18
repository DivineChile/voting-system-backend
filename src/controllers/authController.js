import { supabaseAdmin } from '../config/supabase.js';

export async function getCurrentUser(req, res) {
  try {
    const authUser = req.authUser;

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, auth_user_id, full_name, email, matric_no, department, role, is_eligible, is_active, created_at')
      .eq('auth_user_id', authUser.id)
      .single();

    if (error || !profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found for authenticated user.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        auth: {
          id: authUser.id,
          email: authUser.email,
        },
        profile,
      },
    });
  } catch (error) {
    console.error('getCurrentUser error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch current user.',
    });
  }
}