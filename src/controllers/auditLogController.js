import { supabaseAdmin } from '../config/supabase.js';
import { handleSupabaseError } from '../utils/handleSupabaseError.js';

export async function getAuditLogs(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .select(`
        id,
        actor_id,
        action,
        entity_type,
        entity_id,
        description,
        metadata,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      const formattedError = handleSupabaseError(error, 'Failed to fetch audit logs.');
      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('getAuditLogs error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching audit logs.',
    });
  }
}