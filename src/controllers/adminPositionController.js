import { supabaseAdmin } from '../config/supabase.js';
import { createAuditLog } from '../utils/createAuditLog.js';
import { handleSupabaseError } from '../utils/handleSupabaseError.js';
import {
  canModifyElectionStructure,
  getElectionLockedMessage,
} from '../utils/electionLifecycle.js';

export async function getElectionsForAdmin(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('elections')
      .select('id, title, status, start_time, end_time, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      const formattedError = handleSupabaseError(error, 'Failed to fetch elections.');
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
    console.error('getElectionsForAdmin error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching elections.',
    });
  }
}

export async function createPosition(req, res) {
  try {
    const {
      election_id,
      title,
      description = null,
      display_order = 1,
      max_selections = 1,
    } = req.body;

    if (!election_id || !title) {
      return res.status(400).json({
        success: false,
        message: 'election_id and title are required.',
      });
    }

    const parsedDisplayOrder = Number(display_order);
    const parsedMaxSelections = Number(max_selections);

    if (Number.isNaN(parsedDisplayOrder) || parsedDisplayOrder < 1) {
      return res.status(400).json({
        success: false,
        message: 'display_order must be a number greater than or equal to 1.',
      });
    }

    if (Number.isNaN(parsedMaxSelections) || parsedMaxSelections < 1) {
      return res.status(400).json({
        success: false,
        message: 'max_selections must be a number greater than or equal to 1.',
      });
    }

    const { data: election, error: electionError } = await supabaseAdmin
      .from('elections')
      .select('id, status')
      .eq('id', election_id)
      .single();

    if (electionError || !election) {
      return res.status(404).json({
        success: false,
        message: 'Selected election was not found.',
      });
    }

    if (!canModifyElectionStructure(election.status)) {
      return res.status(409).json({
        success: false,
        message: getElectionLockedMessage(election.status),
      });
    }

    const { data, error } = await supabaseAdmin
      .from('positions')
      .insert([
        {
          election_id,
          title: title.trim(),
          description: description?.trim() || null,
          display_order: parsedDisplayOrder,
          max_selections: parsedMaxSelections,
        },
      ])
      .select()
      .single();

    if (error) {
      const formattedError = handleSupabaseError(error, 'Failed to create position.');
      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    await createAuditLog({
    actorId: req.profile.id,
    action: 'create_position',
    entityType: 'position',
    entityId: data.id,
    description: `Admin created position: ${data.title}`,
    metadata: {
        election_id: data.election_id,
        title: data.title,
        display_order: data.display_order,
        max_selections: data.max_selections,
    },
    });

    return res.status(201).json({
      success: true,
      message: 'Position created successfully.',
      data,
    });
  } catch (error) {
    console.error('createPosition error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while creating position.',
    });
  }
}

export async function updatePosition(req, res) {
  try {
    const { positionId } = req.params;
    const {
      title,
      description = null,
      display_order = 1,
      max_selections = 1,
    } = req.body;

    if (!positionId) {
      return res.status(400).json({
        success: false,
        message: 'Position ID is required.',
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'title is required.',
      });
    }

    const parsedDisplayOrder = Number(display_order);
    const parsedMaxSelections = Number(max_selections);

    if (Number.isNaN(parsedDisplayOrder) || parsedDisplayOrder < 1) {
      return res.status(400).json({
        success: false,
        message: 'display_order must be a number greater than or equal to 1.',
      });
    }

    if (Number.isNaN(parsedMaxSelections) || parsedMaxSelections < 1) {
      return res.status(400).json({
        success: false,
        message: 'max_selections must be a number greater than or equal to 1.',
      });
    }

    const { data: existingPosition, error: existingError } = await supabaseAdmin
      .from('positions')
      .select(`
        id,
        election_id,
        elections (
          id,
          status
        )
      `)
      .eq('id', positionId)
      .single();

    if (existingError || !existingPosition) {
      return res.status(404).json({
        success: false,
        message: 'Position not found.',
      });
    }

    const electionStatus = existingPosition.elections?.status;

    if (!canModifyElectionStructure(electionStatus)) {
      return res.status(409).json({
        success: false,
        message: getElectionLockedMessage(electionStatus),
      });
    }

    const { data, error } = await supabaseAdmin
      .from('positions')
      .update({
        title: title.trim(),
        description: description?.trim() || null,
        display_order: parsedDisplayOrder,
        max_selections: parsedMaxSelections,
      })
      .eq('id', positionId)
      .select()
      .single();

    if (error) {
      const formattedError = handleSupabaseError(error, 'Failed to update position.');
      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    await createAuditLog({
    actorId: req.profile.id,
    action: 'update_position',
    entityType: 'position',
    entityId: data.id,
    description: `Admin updated position: ${data.title}`,
    metadata: {
        election_id: data.election_id,
        title: data.title,
        display_order: data.display_order,
        max_selections: data.max_selections,
    },
    });

    return res.status(200).json({
      success: true,
      message: 'Position updated successfully.',
      data,
    });
  } catch (error) {
    console.error('updatePosition error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while updating position.',
    });
  }
}