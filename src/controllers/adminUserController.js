import { supabaseAdmin } from '../config/supabase.js';
import { handleSupabaseError } from '../utils/handleSupabaseError.js';
import { createAuditLog } from '../utils/createAuditLog.js';

export async function createUser(req, res) {
  try {
    const {
      email,
      password,
      full_name,
      role,
      department = null,
      matric_no = null,
      is_eligible = false,
    } = req.body;

    if (!email || !password || !full_name || !role) {
      return res.status(400).json({
        success: false,
        message: 'email, password, full_name, and role are required.',
      });
    }

    const allowedRoles = ['admin', 'student', 'election_officer'];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role provided.',
      });
    }

    if (role === 'student' && !matric_no) {
      return res.status(400).json({
        success: false,
        message: 'matric_no is required for student accounts.',
      });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
        department,
        matric_no,
        is_eligible,
      },
    });

    if (error) {
      const formattedError = handleSupabaseError(error, 'Failed to create user.');
      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    await createAuditLog({
      actorId: req.profile.id,
      action: 'create_user',
      entityType: 'profile',
      entityId: null,
      description: `Admin created a new ${role} user account.`,
      metadata: {
        auth_user_id: data.user?.id,
        email: data.user?.email,
        role,
        department,
        matric_no,
        is_eligible,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'User created successfully.',
      data: {
        auth_user_id: data.user?.id,
        email: data.user?.email,
      },
    });
  } catch (error) {
    console.error('createUser error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while creating user.',
    });
  }
}