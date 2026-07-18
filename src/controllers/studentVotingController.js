import { supabaseAdmin } from '../config/supabase.js';
import { handleSupabaseError } from '../utils/handleSupabaseError.js';

export async function getActiveElectionForStudent(req, res) {
  try {
    console.log('--- student voting debug start ---');
    console.log('profile:', {
      id: req.profile?.id,
      role: req.profile?.role,
      is_active: req.profile?.is_active,
      is_eligible: req.profile?.is_eligible,
    });

    if (req.profile.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can access the voting page.',
      });
    }

    if (!req.profile.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account is inactive.',
      });
    }

    if (!req.profile.is_eligible) {
      return res.status(403).json({
        success: false,
        message: 'You are not eligible to vote.',
      });
    }

    const now = new Date().toISOString();
    console.log('server now:', now);

    const { data: elections, error: electionError } = await supabaseAdmin
      .from('elections')
      .select(`
        id,
        title,
        description,
        start_time,
        end_time,
        status,
        created_at
      `)
      .eq('status', 'active')
      .order('start_time', { ascending: true });

    console.log('active elections returned from db:', elections);
    console.log('election query error:', electionError);

    if (electionError) {
      const formattedError = handleSupabaseError(
        electionError,
        'Failed to load active election.'
      );

      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    const election = (elections || []).find((item) => {
      const hasStarted = now >= item.start_time;
      const hasNotEnded = now <= item.end_time;

      console.log('checking election:', {
        id: item.id,
        title: item.title,
        start_time: item.start_time,
        end_time: item.end_time,
        hasStarted,
        hasNotEnded,
      });

      return hasStarted && hasNotEnded;
    });

    console.log('matched election:', election);

    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'There is currently no election open for voting.',
      });
    }

    const { data: existingBallot, error: ballotCheckError } = await supabaseAdmin
      .from('ballots')
      .select('id')
      .eq('election_id', election.id)
      .eq('voter_id', req.profile.id)
      .maybeSingle();

    console.log('existing ballot:', existingBallot);
    console.log('ballot check error:', ballotCheckError);

    if (ballotCheckError) {
      const formattedError = handleSupabaseError(
        ballotCheckError,
        'Failed to check voting status.'
      );

      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
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
      .eq('election_id', election.id)
      .eq('is_active', true)
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

    const ballotStructure = (positions || []).map((position) => ({
      ...position,
      candidates: (candidates || []).filter(
        (candidate) => candidate.position_id === position.id
      ),
    }));

    return res.status(200).json({
      success: true,
      data: {
        election,
        has_voted: !!existingBallot,
        positions: ballotStructure,
      },
    });
  } catch (error) {
    console.error('getActiveElectionForStudent error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while loading the voting page.',
    });
  }
}

export async function submitBallot(req, res) {
  try {
    if (req.profile.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can submit a ballot.',
      });
    }

    if (!req.profile.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account is inactive.',
      });
    }

    if (!req.profile.is_eligible) {
      return res.status(403).json({
        success: false,
        message: 'You are not eligible to vote.',
      });
    }

    const { election_id, selections } = req.body;

    if (!election_id || !Array.isArray(selections) || selections.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'election_id and selections are required.',
      });
    }

    const now = new Date().toISOString();

    const { data: election, error: electionError } = await supabaseAdmin
      .from('elections')
      .select('id, status, start_time, end_time')
      .eq('id', election_id)
      .single();

    if (electionError || !election) {
      return res.status(404).json({
        success: false,
        message: 'Election not found.',
      });
    }

    if (election.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'This election is not currently active.',
      });
    }

    if (now < election.start_time || now > election.end_time) {
      return res.status(400).json({
        success: false,
        message: 'Voting is not available at this time.',
      });
    }

    const { data: existingBallot, error: ballotCheckError } = await supabaseAdmin
      .from('ballots')
      .select('id')
      .eq('election_id', election_id)
      .eq('voter_id', req.profile.id)
      .maybeSingle();

    if (ballotCheckError) {
      const formattedError = handleSupabaseError(
        ballotCheckError,
        'Failed to verify whether you already voted.'
      );

      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    if (existingBallot) {
      return res.status(409).json({
        success: false,
        message: 'You have already voted in this election.',
      });
    }

    const selectionPositionIds = selections.map((item) => item.position_id);
    const selectionCandidateIds = selections.map((item) => item.candidate_id);

    const hasDuplicatePositions =
      new Set(selectionPositionIds).size !== selectionPositionIds.length;

    if (hasDuplicatePositions) {
      return res.status(400).json({
        success: false,
        message: 'You can only make one selection per position.',
      });
    }

    const { data: positions, error: positionsError } = await supabaseAdmin
      .from('positions')
      .select('id, election_id, max_selections')
      .eq('election_id', election_id);

    if (positionsError) {
      const formattedError = handleSupabaseError(
        positionsError,
        'Failed to validate ballot positions.'
      );

      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    const { data: candidates, error: candidatesError } = await supabaseAdmin
      .from('candidates')
      .select('id, election_id, position_id, is_active')
      .eq('election_id', election_id)
      .eq('is_active', true);

    if (candidatesError) {
      const formattedError = handleSupabaseError(
        candidatesError,
        'Failed to validate ballot candidates.'
      );

      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    const positionMap = new Map((positions || []).map((position) => [position.id, position]));
    const candidateMap = new Map((candidates || []).map((candidate) => [candidate.id, candidate]));

    for (const selection of selections) {
      const position = positionMap.get(selection.position_id);
      const candidate = candidateMap.get(selection.candidate_id);

      if (!position) {
        return res.status(400).json({
          success: false,
          message: 'One or more selected positions are invalid.',
        });
      }

      if (!candidate) {
        return res.status(400).json({
          success: false,
          message: 'One or more selected candidates are invalid.',
        });
      }

      if (candidate.position_id !== selection.position_id) {
        return res.status(400).json({
          success: false,
          message: 'A selected candidate does not belong to the selected position.',
        });
      }

      if (position.max_selections !== 1) {
        return res.status(400).json({
          success: false,
          message: 'This version currently supports one selection per position only.',
        });
      }
    }

    const { data: ballot, error: ballotInsertError } = await supabaseAdmin
      .from('ballots')
      .insert([
        {
          election_id,
          voter_id: req.profile.id,
        },
      ])
      .select()
      .single();

    if (ballotInsertError) {
      const formattedError = handleSupabaseError(
        ballotInsertError,
        'Failed to create ballot.'
      );

      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    const ballotItemsPayload = selections.map((selection) => ({
      ballot_id: ballot.id,
      position_id: selection.position_id,
      candidate_id: selection.candidate_id,
    }));

    const { error: ballotItemsError } = await supabaseAdmin
      .from('ballot_items')
      .insert(ballotItemsPayload);

    if (ballotItemsError) {
      const formattedError = handleSupabaseError(
        ballotItemsError,
        'Failed to save ballot selections.'
      );

      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    await supabaseAdmin.from('audit_logs').insert([
      {
        actor_id: req.profile.id,
        action: 'submit_ballot',
        entity_type: 'ballot',
        entity_id: ballot.id,
        description: 'Student submitted ballot successfully.',
        metadata: {
          election_id,
          selections_count: selections.length,
        },
      },
    ]);

    return res.status(201).json({
      success: true,
      message: 'Your ballot has been submitted successfully.',
      data: {
        ballot_id: ballot.id,
      },
    });
  } catch (error) {
    console.error('submitBallot error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while submitting ballot.',
    });
  }
}