import { supabaseAdmin } from '../config/supabase.js';
import { handleSupabaseError } from '../utils/handleSupabaseError.js';

export async function getAdminDashboardSummary(req, res) {
  try {
    const today = new Date();
    const startOfToday = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0)
    ).toISOString();

    const endOfToday = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999)
    ).toISOString();

    const [
      electionsResult,
      activeElectionsResult,
      usersResult,
      ballotsTodayResult,
      electionsOverviewResult,
      positionsResult,
      ballotsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('elections')
        .select('id', { count: 'exact', head: true }),

      supabaseAdmin
        .from('elections')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),

      supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true }),

      supabaseAdmin
        .from('ballots')
        .select('id', { count: 'exact', head: true })
        .gte('submitted_at', startOfToday)
        .lte('submitted_at', endOfToday),

      supabaseAdmin
        .from('elections')
        .select(`
          id,
          title,
          status,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(4),

      supabaseAdmin
        .from('positions')
        .select('id, election_id'),

      supabaseAdmin
        .from('ballots')
        .select('id, election_id'),
    ]);

    const possibleErrors = [
      electionsResult.error,
      activeElectionsResult.error,
      usersResult.error,
      ballotsTodayResult.error,
      electionsOverviewResult.error,
      positionsResult.error,
      ballotsResult.error,
    ].filter(Boolean);

    if (possibleErrors.length > 0) {
      const formattedError = handleSupabaseError(
        possibleErrors[0],
        'Failed to load dashboard summary.'
      );

      return res.status(formattedError.status).json({
        success: false,
        message: formattedError.message,
      });
    }

    const electionsOverview = (electionsOverviewResult.data || []).map((election) => {
      const positionsCount = (positionsResult.data || []).filter(
        (position) => position.election_id === election.id
      ).length;

      const votesCount = (ballotsResult.data || []).filter(
        (ballot) => ballot.election_id === election.id
      ).length;

      return {
        id: election.id,
        name: election.title,
        positions: positionsCount,
        votes: votesCount,
        status: election.status,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          total_elections: electionsResult.count || 0,
          active_now: activeElectionsResult.count || 0,
          registered_users: usersResult.count || 0,
          votes_cast_today: ballotsTodayResult.count || 0,
        },
        elections_overview: electionsOverview,
      },
    });
  } catch (error) {
    console.error('getAdminDashboardSummary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while loading dashboard summary.',
    });
  }
}