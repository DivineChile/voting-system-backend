import { supabaseAdmin } from '../config/supabase.js';
import { handleSupabaseError } from '../utils/handleSupabaseError.js';

function buildResultsByPosition(positions, candidates, ballotItems) {
  return (positions || []).map((position) => {
    const positionCandidates = (candidates || [])
      .filter((candidate) => candidate.position_id === position.id)
      .map((candidate) => {
        const votes = (ballotItems || []).filter(
          (item) => item.position_id === position.id && item.candidate_id === candidate.id
        ).length;

        return {
          ...candidate,
          votes,
        };
      })
      .sort((a, b) => b.votes - a.votes || a.full_name.localeCompare(b.full_name));

    const highestVotes = positionCandidates.length > 0 ? positionCandidates[0].votes : 0;

    const winners = positionCandidates.filter(
      (candidate) => candidate.votes === highestVotes && highestVotes > 0
    );

    return {
      ...position,
      candidates: positionCandidates,
      winners,
    };
  });
}

export async function getElectionResultsForAdmin(req, res) {
  try {
    const { electionId } = req.params;

    if (!electionId) {
      return res.status(400).json({
        success: false,
        message: 'Election ID is required.',
      });
    }

    const { data: election, error: electionError } = await supabaseAdmin
      .from('elections')
      .select(`
        id,
        title,
        description,
        status,
        start_time,
        end_time,
        published_at,
        created_at
      `)
      .eq('id', electionId)
      .single();

    if (electionError || !election) {
      return res.status(404).json({
        success: false,
        message: 'Election not found.',
      });
    }

    const { data: positions, error: positionsError } = await supabaseAdmin
      .from('positions')
      .select(`
        id,
        election_id,
        title,
        description,
        display_order,
        max_selections
      `)
      .eq('election_id', electionId)
      .order('display_order', { ascending: true });

    if (positionsError) {
      const formattedError = handleSupabaseError(
        positionsError,
        'Failed to load election positions.'
      );

      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    const { data: candidates, error: candidatesError } = await supabaseAdmin
      .from('candidates')
      .select(`
        id,
        election_id,
        position_id,
        full_name,
        matric_no,
        department,
        level,
        manifesto,
        image_url,
        is_active
      `)
      .eq('election_id', electionId)
      .order('created_at', { ascending: true });

    if (candidatesError) {
      const formattedError = handleSupabaseError(
        candidatesError,
        'Failed to load election candidates.'
      );

      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    const { data: ballots, error: ballotsError } = await supabaseAdmin
      .from('ballots')
      .select('id, election_id, voter_id, submitted_at')
      .eq('election_id', electionId);

    if (ballotsError) {
      const formattedError = handleSupabaseError(
        ballotsError,
        'Failed to load ballots.'
      );

      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    const { data: ballotItems, error: ballotItemsError } = await supabaseAdmin
      .from('ballot_items')
      .select('id, ballot_id, position_id, candidate_id, created_at')
      .in('ballot_id', (ballots || []).map((ballot) => ballot.id).length > 0 ? (ballots || []).map((ballot) => ballot.id) : ['00000000-0000-0000-0000-000000000000']);

    if (ballotItemsError) {
      const formattedError = handleSupabaseError(
        ballotItemsError,
        'Failed to load ballot items.'
      );

      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    const results = buildResultsByPosition(positions, candidates, ballotItems);

    return res.status(200).json({
      success: true,
      data: {
        election,
        total_ballots: ballots?.length || 0,
        positions: results,
      },
    });
  } catch (error) {
    console.error('getElectionResultsForAdmin error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while loading election results.',
    });
  }
}

export async function getPublishedResultsForStudent(req, res) {
  try {
    const { data: election, error: electionError } = await supabaseAdmin
      .from('elections')
      .select(`
        id,
        title,
        description,
        status,
        start_time,
        end_time,
        published_at,
        created_at
      `)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (electionError) {
      const formattedError = handleSupabaseError(
        electionError,
        'Failed to load published results.'
      );

      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'No published election results are available yet.',
      });
    }

    const { data: positions, error: positionsError } = await supabaseAdmin
      .from('positions')
      .select(`
        id,
        election_id,
        title,
        description,
        display_order,
        max_selections
      `)
      .eq('election_id', election.id)
      .order('display_order', { ascending: true });

    if (positionsError) {
      const formattedError = handleSupabaseError(
        positionsError,
        'Failed to load result positions.'
      );

      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    const { data: candidates, error: candidatesError } = await supabaseAdmin
      .from('candidates')
      .select(`
        id,
        election_id,
        position_id,
        full_name,
        matric_no,
        department,
        level,
        manifesto,
        image_url,
        is_active
      `)
      .eq('election_id', election.id)
      .order('created_at', { ascending: true });

    if (candidatesError) {
      const formattedError = handleSupabaseError(
        candidatesError,
        'Failed to load result candidates.'
      );

      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    const { data: ballots, error: ballotsError } = await supabaseAdmin
      .from('ballots')
      .select('id')
      .eq('election_id', election.id);

    if (ballotsError) {
      const formattedError = handleSupabaseError(
        ballotsError,
        'Failed to load result ballots.'
      );

      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    const ballotIds = (ballots || []).map((ballot) => ballot.id);

    const { data: ballotItems, error: ballotItemsError } = await supabaseAdmin
      .from('ballot_items')
      .select('id, ballot_id, position_id, candidate_id, created_at')
      .in('ballot_id', ballotIds.length > 0 ? ballotIds : ['00000000-0000-0000-0000-000000000000']);

    if (ballotItemsError) {
      const formattedError = handleSupabaseError(
        ballotItemsError,
        'Failed to load result ballot items.'
      );

      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    const results = buildResultsByPosition(positions, candidates, ballotItems);

    return res.status(200).json({
      success: true,
      data: {
        election,
        total_ballots: ballots?.length || 0,
        positions: results,
      },
    });
  } catch (error) {
    console.error('getPublishedResultsForStudent error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while loading published results.',
    });
  }
}