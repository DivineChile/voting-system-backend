import { supabaseAdmin } from '../config/supabase.js';
import { handleSupabaseError } from '../utils/handleSupabaseError.js';
import { createAuditLog } from '../utils/createAuditLog.js';
import { canModifyElectionStructure, getElectionLockedMessage } from '../utils/electionLifecycle.js';

const ALLOWED_STATUSES = ['draft', 'active', 'closed', 'published'];

function canTransitionElectionStatus(currentStatus, nextStatus) {
  const allowedTransitions = {
    draft: ['active'],
    active: ['closed'],
    closed: ['published'],
    published: [],
  };

  return allowedTransitions[currentStatus]?.includes(nextStatus) || false;
}

function getStatusTransitionMessage(currentStatus) {
  if (currentStatus === 'published') {
    return 'Published elections are locked and their status cannot be changed.';
  }

  if (currentStatus === 'closed') {
    return 'Closed elections can only be published.';
  }

  if (currentStatus === 'active') {
    return 'Active elections can only be closed.';
  }

  if (currentStatus === 'draft') {
    return 'Draft elections can only be activated.';
  }

  return 'This election status cannot be changed.';
}

export async function getAdminElections(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('elections')
      .select(`
        id,
        title,
        description,
        start_time,
        end_time,
        status,
        published_at,
        created_at,
        created_by
      `)
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
    console.error('getAdminElections error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching elections.',
    });
  }
}

export async function createElection(req, res) {
  try {
    const { title, description = null, start_time, end_time } = req.body;

    if (!title || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: 'title, start_time, and end_time are required.',
      });
    }

    const startDate = new Date(start_time);
    const endDate = new Date(end_time);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid start_time or end_time format.',
      });
    }

    if (endDate <= startDate) {
      return res.status(400).json({
        success: false,
        message: 'end_time must be later than start_time.',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('elections')
      .insert([
        {
          title: title.trim(),
          description: description?.trim() || null,
          start_time,
          end_time,
          status: 'draft',
          created_by: req.profile.id,
        },
      ])
      .select()
      .single();

    if (error) {
      const formattedError = handleSupabaseError(error, 'Failed to create election.');
      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    await createAuditLog({
        actorId: req.profile.id,
        action: 'create_election',
        entityType: 'election',
        entityId: data.id,
        description: `Admin created election: ${data.title}`,
        metadata: {
            title: data.title,
            start_time: data.start_time,
            end_time: data.end_time,
            status: data.status,
        },
    });

    return res.status(201).json({
      success: true,
      message: 'Election created successfully.',
      data,
    });
  } catch (error) {
    console.error('createElection error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while creating election.',
    });
  }
}

export async function updateElection(req, res) {
  try {
    const { electionId } = req.params;
    const { title, description = null, start_time, end_time } = req.body;

    if (!electionId) {
      return res.status(400).json({
        success: false,
        message: 'Election ID is required.',
      });
    }

    if (!title || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: 'title, start_time, and end_time are required.',
      });
    }

    const startDate = new Date(start_time);
    const endDate = new Date(end_time);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid start_time or end_time format.',
      });
    }

    if (endDate <= startDate) {
      return res.status(400).json({
        success: false,
        message: 'end_time must be later than start_time.',
      });
    }

    const { data: existingElection, error: fetchError } = await supabaseAdmin
      .from('elections')
      .select('id, status')
      .eq('id', electionId)
      .single();

    if (fetchError || !existingElection) {
      return res.status(404).json({
        success: false,
        message: 'Election not found.',
      });
    }

    if (!canModifyElectionStructure(existingElection.status)) {
      return res.status(409).json({
        success: false,
        message: getElectionLockedMessage(existingElection.status),
      });
    }

    const { data, error } = await supabaseAdmin
      .from('elections')
      .update({
        title: title.trim(),
        description: description?.trim() || null,
        start_time,
        end_time,
      })
      .eq('id', electionId)
      .select()
      .single();

    if (error) {
      const formattedError = handleSupabaseError(error, 'Failed to update election.');
      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    await createAuditLog({
    actorId: req.profile.id,
    action: 'update_election',
    entityType: 'election',
    entityId: data.id,
    description: `Admin updated election: ${data.title}`,
    metadata: {
        title: data.title,
        start_time: data.start_time,
        end_time: data.end_time,
    },
    });

    return res.status(200).json({
      success: true,
      message: 'Election updated successfully.',
      data,
    });
  } catch (error) {
    console.error('updateElection error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while updating election.',
    });
  }
}

export async function updateElectionStatus(req, res) {
  try {
    const { electionId } = req.params;
    const { status } = req.body;

    if (!electionId) {
      return res.status(400).json({
        success: false,
        message: 'Election ID is required.',
      });
    }

    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'A valid election status is required.',
      });
    }

    const { data: existingElection, error: fetchError } = await supabaseAdmin
      .from('elections')
      .select('id, status, published_at')
      .eq('id', electionId)
      .single();

    if (fetchError || !existingElection) {
      return res.status(404).json({
        success: false,
        message: 'Election not found.',
      });
    }

    if (existingElection.status === status) {
      return res.status(400).json({
        success: false,
        message: `Election is already in ${status} status.`,
      });
    }

    if (!canTransitionElectionStatus(existingElection.status, status)) {
      return res.status(409).json({
        success: false,
        message: getStatusTransitionMessage(existingElection.status),
      });
    }

    const updatePayload = {
      status,
    };

    if (status === 'published') {
      updatePayload.published_at = new Date().toISOString();
    } else {
      updatePayload.published_at = null;
    }

    const { data, error } = await supabaseAdmin
      .from('elections')
      .update(updatePayload)
      .eq('id', electionId)
      .select()
      .single();

    if (error) {
      const formattedError = handleSupabaseError(error, 'Failed to update election status.');
      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    await createAuditLog({
    actorId: req.profile.id,
    action: 'update_election_status',
    entityType: 'election',
    entityId: data.id,
    description: `Admin changed election status to ${data.status}.`,
    metadata: {
        election_id: data.id,
        status: data.status,
        published_at: data.published_at,
    },
    });

    return res.status(200).json({
      success: true,
      message: 'Election status updated successfully.',
      data,
    });
  } catch (error) {
    console.error('updateElectionStatus error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while updating election status.',
    });
  }
}