import { supabaseAdmin } from '../config/supabase.js';
import { createAuditLog } from '../utils/createAuditLog.js';
import { handleSupabaseError } from '../utils/handleSupabaseError.js';
import {
  canModifyElectionStructure,
  getElectionLockedMessage,
} from '../utils/electionLifecycle.js';

export async function getPositionsByElection(req, res) {
  try {
    const { election_id } = req.query;

    if (!election_id) {
      return res.status(400).json({
        success: false,
        message: 'election_id is required.',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('positions')
      .select('id, election_id, title, display_order, max_selections, created_at')
      .eq('election_id', election_id)
      .order('display_order', { ascending: true });

    if (error) {
      const formattedError = handleSupabaseError(error, 'Failed to fetch positions.');
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
    console.error('getPositionsByElection error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching positions.',
    });
  }
}

export async function createCandidate(req, res) {
  try {
    const {
      election_id,
      position_id,
      full_name,
      matric_no = null,
      department = null,
      level = null,
      manifesto = null,
      image_url = null,
    } = req.body;

    if (!election_id || !position_id || !full_name) {
      return res.status(400).json({
        success: false,
        message: 'election_id, position_id, and full_name are required.',
      });
    }

    const { data: position, error: positionError } = await supabaseAdmin
      .from('positions')
      .select(`
        id,
        election_id,
        elections (
          id,
          status
        )
      `)
      .eq('id', position_id)
      .single();

    if (positionError || !position) {
      return res.status(404).json({
        success: false,
        message: 'Selected position was not found.',
      });
    }

    if (position.election_id !== election_id) {
      return res.status(400).json({
        success: false,
        message: 'Selected position does not belong to the selected election.',
      });
    }

    const electionStatus = position.elections?.status;

    if (!canModifyElectionStructure(electionStatus)) {
      return res.status(409).json({
        success: false,
        message: getElectionLockedMessage(electionStatus),
      });
    }

    const { data, error } = await supabaseAdmin
      .from('candidates')
      .insert([
        {
          election_id,
          position_id,
          full_name: full_name.trim(),
          matric_no: matric_no?.trim() || null,
          department: department?.trim() || null,
          level: level?.trim() || null,
          manifesto: manifesto?.trim() || null,
          image_url: image_url?.trim() || null,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (error) {
      const formattedError = handleSupabaseError(error, 'Failed to create candidate.');
      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    await createAuditLog({
    actorId: req.profile.id,
    action: 'create_candidate',
    entityType: 'candidate',
    entityId: data.id,
    description: `Admin created candidate: ${data.full_name}`,
    metadata: {
        election_id: data.election_id,
        position_id: data.position_id,
        full_name: data.full_name,
    },
    });

    return res.status(201).json({
      success: true,
      message: 'Candidate created successfully.',
      data,
    });
  } catch (error) {
    console.error('createCandidate error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while creating candidate.',
    });
  }
}

export async function updateCandidate(req, res) {
  try {
    const { candidateId } = req.params;
    const {
      full_name,
      matric_no = null,
      department = null,
      level = null,
      manifesto = null,
      image_url = null,
    } = req.body;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required.',
      });
    }

    if (!full_name) {
      return res.status(400).json({
        success: false,
        message: 'full_name is required.',
      });
    }

    const { data: existingCandidate, error: existingError } = await supabaseAdmin
      .from('candidates')
      .select(`
        id,
        election_id,
        elections (
          id,
          status
        )
      `)
      .eq('id', candidateId)
      .single();

    if (existingError || !existingCandidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found.',
      });
    }

    const electionStatus = existingCandidate.elections?.status;

    if (!canModifyElectionStructure(electionStatus)) {
      return res.status(409).json({
        success: false,
        message: getElectionLockedMessage(electionStatus),
      });
    }

    const { data, error } = await supabaseAdmin
      .from('candidates')
      .update({
        full_name: full_name.trim(),
        matric_no: matric_no?.trim() || null,
        department: department?.trim() || null,
        level: level?.trim() || null,
        manifesto: manifesto?.trim() || null,
        image_url: image_url?.trim() || null,
      })
      .eq('id', candidateId)
      .select()
      .single();

    if (error) {
      const formattedError = handleSupabaseError(error, 'Failed to update candidate.');
      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    await createAuditLog({
    actorId: req.profile.id,
    action: 'update_candidate',
    entityType: 'candidate',
    entityId: data.id,
    description: `Admin updated candidate: ${data.full_name}`,
    metadata: {
        election_id: data.election_id,
        position_id: data.position_id,
        full_name: data.full_name,
    },
    });

    return res.status(200).json({
      success: true,
      message: 'Candidate updated successfully.',
      data,
    });
  } catch (error) {
    console.error('updateCandidate error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while updating candidate.',
    });
  }
}

export async function toggleCandidateStatus(req, res) {
  try {
    const { candidateId } = req.params;
    const { is_active } = req.body;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required.',
      });
    }

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'is_active must be a boolean value.',
      });
    }

    const { data: existingCandidate, error: existingError } = await supabaseAdmin
      .from('candidates')
      .select(`
        id,
        election_id,
        elections (
          id,
          status
        )
      `)
      .eq('id', candidateId)
      .single();

    if (existingError || !existingCandidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found.',
      });
    }

    const electionStatus = existingCandidate.elections?.status;

    if (!canModifyElectionStructure(electionStatus)) {
      return res.status(409).json({
        success: false,
        message: getElectionLockedMessage(electionStatus),
      });
    }

    const { data, error } = await supabaseAdmin
      .from('candidates')
      .update({ is_active })
      .eq('id', candidateId)
      .select()
      .single();

    if (error) {
      const formattedError = handleSupabaseError(error, 'Failed to update candidate status.');
      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    await createAuditLog({
    actorId: req.profile.id,
    action: is_active ? 'activate_candidate' : 'deactivate_candidate',
    entityType: 'candidate',
    entityId: data.id,
    description: `Admin ${is_active ? 'activated' : 'deactivated'} candidate: ${data.full_name}`,
    metadata: {
        election_id: data.election_id,
        position_id: data.position_id,
        full_name: data.full_name,
        is_active: data.is_active,
    },
    });

    return res.status(200).json({
      success: true,
      message: `Candidate ${is_active ? 'activated' : 'deactivated'} successfully.`,
      data,
    });
  } catch (error) {
    console.error('toggleCandidateStatus error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while updating candidate status.',
    });
  }
}