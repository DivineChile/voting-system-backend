import { supabaseAdmin } from '../config/supabase.js';
import { handleSupabaseError } from '../utils/handleSupabaseError.js';
import { getElectionIntelligence } from '../services/electionAnalyticsService.js';

const round = (value) => Number(Number(value).toFixed(2));

const percentage = (numerator, denominator) => {
  if (!denominator) return 0;
  return round((numerator / denominator) * 100);
};

const groupBy = (array, keyFn) => {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});
};

const normalizeLabel = (value) => {
  const trimmed = (value || '').toString().trim();
  return trimmed.length > 0 ? trimmed : 'Unspecified';
};

function truncateBucket(dateString, bucket) {
  const date = new Date(dateString);

  if (bucket === 'hour') {
    date.setUTCMinutes(0, 0, 0);
  } else {
    date.setUTCHours(0, 0, 0, 0);
  }

  return date.toISOString();
}

function buildVotesOverTime(ballots, bucket) {
  const byBucket = groupBy(ballots, (ballot) => truncateBucket(ballot.submitted_at, bucket));

  const bucketStarts = Object.keys(byBucket).sort();

  let cumulative = 0;

  return bucketStarts.map((bucketStart) => {
    const votes = byBucket[bucketStart].length;
    cumulative += votes;

    return {
      bucket_start: bucketStart,
      votes,
      cumulative_votes: cumulative,
    };
  });
}

function buildBreakdown(eligibleProfiles, scopedBallots, profilesById, field) {
  const eligibleByLabel = groupBy(eligibleProfiles, (profile) => normalizeLabel(profile[field]));

  const votersByLabel = {};

  scopedBallots.forEach((ballot) => {
    const voter = profilesById.get(ballot.voter_id);
    if (!voter) return;

    const label = normalizeLabel(voter[field]);
    if (!votersByLabel[label]) votersByLabel[label] = 0;
    votersByLabel[label] += 1;
  });

  const labels = new Set([...Object.keys(eligibleByLabel), ...Object.keys(votersByLabel)]);

  return Array.from(labels)
    .map((label) => {
      const eligibleCount = (eligibleByLabel[label] || []).length;
      const votedCount = votersByLabel[label] || 0;

      return {
        [field]: label,
        eligible_count: eligibleCount,
        voted_count: votedCount,
        turnout_percentage: percentage(votedCount, eligibleCount),
      };
    })
    .sort((a, b) => b.turnout_percentage - a.turnout_percentage);
}

export async function getAdminAnalyticsOverview(req, res) {
  try {
    const { electionId } = req.query;
    const bucket = req.query.bucket === 'hour' ? 'hour' : 'day';

    const [
      electionsResult,
      ballotsResult,
      positionsResult,
      candidatesResult,
      eligibleProfilesResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('elections')
        .select('id, title, status, start_time, end_time'),

      supabaseAdmin
        .from('ballots')
        .select('id, election_id, voter_id, submitted_at'),

      supabaseAdmin
        .from('positions')
        .select('id, election_id'),

      supabaseAdmin
        .from('candidates')
        .select('id, election_id, is_active'),

      supabaseAdmin
        .from('profiles')
        .select('id, department')
        .eq('role', 'student')
        .eq('is_active', true)
        .eq('is_eligible', true),
    ]);

    const possibleErrors = [
      electionsResult.error,
      ballotsResult.error,
      positionsResult.error,
      candidatesResult.error,
      eligibleProfilesResult.error,
    ].filter(Boolean);

    if (possibleErrors.length > 0) {
      const formattedError = handleSupabaseError(
        possibleErrors[0],
        'Failed to load analytics overview.'
      );

      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    const elections = electionsResult.data || [];
    const ballots = ballotsResult.data || [];
    const positions = positionsResult.data || [];
    const candidates = candidatesResult.data || [];
    const eligibleProfiles = eligibleProfilesResult.data || [];

    const eligibleStudents = eligibleProfiles.length;

    const ballotsByElection = groupBy(ballots, (ballot) => ballot.election_id);
    const positionsByElection = groupBy(positions, (position) => position.election_id);
    const candidatesByElection = groupBy(candidates, (candidate) => candidate.election_id);

    const totals = {
      total_elections: elections.length,
      draft: elections.filter((e) => e.status === 'draft').length,
      active: elections.filter((e) => e.status === 'active').length,
      closed: elections.filter((e) => e.status === 'closed').length,
      published: elections.filter((e) => e.status === 'published').length,
      total_ballots_all_time: ballots.length,
      eligible_students: eligibleStudents,
      total_positions: positions.length,
      total_candidates: candidates.filter((c) => c.is_active).length,
    };

    const electionComparison = [...elections]
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
      .slice(0, 15)
      .map((election) => {
        const electionBallots = ballotsByElection[election.id] || [];
        const electionPositions = positionsByElection[election.id] || [];
        const electionCandidates = (candidatesByElection[election.id] || []).filter(
          (c) => c.is_active
        );

        return {
          id: election.id,
          title: election.title,
          status: election.status,
          start_time: election.start_time,
          end_time: election.end_time,
          ballots: electionBallots.length,
          positions: electionPositions.length,
          candidates: electionCandidates.length,
          turnout_percentage: percentage(electionBallots.length, eligibleStudents),
        };
      });

    const statusPriority = { active: 0, closed: 1, published: 2, draft: 3 };

    const fallbackElection = [...elections]
      .filter((e) => e.status !== 'draft')
      .sort((a, b) => {
        const priorityDiff = statusPriority[a.status] - statusPriority[b.status];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
      })[0];

    const scopedElectionId = electionId || fallbackElection?.id || null;

    const scopedBallots = scopedElectionId
      ? ballots.filter((ballot) => ballot.election_id === scopedElectionId)
      : ballots;

    const votesOverTimeSource = electionId ? scopedBallots : ballots;
    const votesOverTime = buildVotesOverTime(votesOverTimeSource, bucket);

    const profilesById = new Map(eligibleProfiles.map((profile) => [profile.id, profile]));

    const departmentBreakdown = buildBreakdown(
      eligibleProfiles,
      scopedBallots,
      profilesById,
      'department'
    );

    return res.status(200).json({
      success: true,
      data: {
        scope: { electionId: scopedElectionId, bucket },
        totals,
        election_comparison: electionComparison,
        votes_over_time: votesOverTime,
        department_breakdown: departmentBreakdown,
      },
    });
  } catch (error) {
    console.error('getAdminAnalyticsOverview error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while loading analytics overview.',
    });
  }
}

export async function getElectionAnalyticsDetail(req, res) {
  try {
    const { electionId } = req.params;

    if (!electionId) {
      return res.status(400).json({
        success: false,
        message: 'Election ID is required.',
      });
    }

    const intelligence = await getElectionIntelligence(supabaseAdmin, electionId);

    return res.status(200).json({
      success: true,
      data: intelligence,
    });
  } catch (error) {
    console.error('getElectionAnalyticsDetail error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while loading election analytics.',
    });
  }
}
