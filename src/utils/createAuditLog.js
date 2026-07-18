import { supabaseAdmin } from '../config/supabase.js';

export async function createAuditLog({
  actorId = null,
  action,
  entityType = null,
  entityId = null,
  description = null,
  metadata = null,
}) {
  try {
    if (!action) {
      return;
    }

    await supabaseAdmin.from('audit_logs').insert([
      {
        actor_id: actorId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        description,
        metadata,
      },
    ]);
  } catch (error) {
    console.error('createAuditLog error:', error);
  }
}