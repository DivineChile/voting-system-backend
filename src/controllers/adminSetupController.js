import { supabaseAdmin } from '../config/supabase.js';
import { handleSupabaseError } from '../utils/handleSupabaseError.js';

export async function getElectionSetup(req, res) {
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
        max_selections,
        created_at
      `)
      .eq('election_id', electionId)
      .order('display_order', { ascending: true });

    if (positionsError) {
      const formattedError = handleSupabaseError(
        positionsError,
        'Failed to fetch positions.'
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
        is_active,
        created_at
      `)
      .eq('election_id', electionId)
      .order('created_at', { ascending: true });

    if (candidatesError) {
      const formattedError = handleSupabaseError(
        candidatesError,
        'Failed to fetch candidates.'
      );

      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    const positionsWithCandidates = (positions || []).map((position) => ({
      ...position,
      candidates: (candidates || []).filter(
        (candidate) => candidate.position_id === position.id
      ),
    }));

    return res.status(200).json({
      success: true,
      data: {
        election,
        positions: positionsWithCandidates,
      },
    });
  } catch (error) {
    console.error('getElectionSetup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching election setup.',
    });
  }
}