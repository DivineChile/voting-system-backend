/**
 * ============================================================================
 * Election Analytics Service
 * ============================================================================
 *
 * Responsible for:
 *  - Current Election Analytics
 *  - Historical Election Analytics
 *  - Participation Metrics
 *  - Competition Metrics
 *  - Voting Activity Metrics
 *  - Audit Intelligence
 *
 * This service DOES NOT communicate with Gemini.
 * It only prepares intelligence for the AI layer.
 * ============================================================================
 */

/**
 * Average
 */
const average = (values = []) => {
  if (!values.length) return 0;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

/**
 * Round to 2 decimal places
 */
const round = (value) => Number(Number(value).toFixed(2));

/**
 * Safe division
 */
const divide = (a, b) => {
  if (!b || b === 0) return 0;

  return a / b;
};

/**
 * Calculate duration (hours)
 */
const calculateDurationHours = (start, end) => {
  return (new Date(end).getTime() - new Date(start).getTime()) / 3600000;
};

/**
 * Detect trend.
 *
 * Returns:
 * Increasing
 * Stable
 * Declining
 */
const detectTrend = (values = []) => {
  if (values.length < 2) return "Insufficient Data";

  const first = values[0];

  const last = values.at(-1);

  const difference = last - first;

  if (Math.abs(difference) < 2) return "Stable";

  return difference > 0 ? "Increasing" : "Declining";
};

/**
 * Percentage helper
 */
const percentage = (numerator, denominator) => {
  return round(divide(numerator, denominator) * 100);
};

/**
 * Group records by a property.
 */
const groupBy = (array, key) => {
  return array.reduce((groups, item) => {
    const value = item[key];

    if (!groups[value]) {
      groups[value] = [];
    }

    groups[value].push(item);

    return groups;
  }, {});
};

/**
 * ============================================================================
 * Load Election Intelligence
 * ============================================================================
 */

export async function getElectionIntelligence(supabase, electionId) {
  console.log("Analytics electionId:", electionId);
  if (!electionId) {
    throw new Error("Election ID is required.");
  }

  /*
    |--------------------------------------------------------------------------
    | Load Current Election
    |--------------------------------------------------------------------------
    */

  const { data: election, error: electionError } = await supabase
    .from("elections")
    .select("*")
    .eq("id", electionId)
    .single();

  if (electionError || !election) {
    throw new Error("Election not found.");
  }

  /*
    |--------------------------------------------------------------------------
    | Eligible Students
    |--------------------------------------------------------------------------
    */

  const { data: eligibleStudentsData, error: studentsError } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "student")
    .eq("is_active", true)
    .eq("is_eligible", true);

  if (studentsError) {
    throw studentsError;
  }

  const eligibleStudents = eligibleStudentsData.length;

  /*
    |--------------------------------------------------------------------------
    | Previous Published Elections
    |--------------------------------------------------------------------------
    */

  const { data: previousElections, error: previousElectionError } =
    await supabase
      .from("elections")
      .select(
        `
            id,
            title,
            start_time,
            end_time,
            published_at
        `,
      )
      .eq("status", "published")
      .neq("id", election.id)
      .order("published_at", {
        ascending: true,
      });

  if (previousElectionError) {
    throw previousElectionError;
  }

  /*
    |--------------------------------------------------------------------------
    | Build Election ID List
    |--------------------------------------------------------------------------
    */

  const electionIds = [
    election.id,

    ...(previousElections ?? []).map((e) => e.id),
  ];

  /*
    |--------------------------------------------------------------------------
    | Batch Load Ballots
    |--------------------------------------------------------------------------
    */

  const { data: ballots, error: ballotError } = await supabase
    .from("ballots")
    .select(
      `
            id,
            election_id,
            voter_id,
            submitted_at
        `,
    )
    .in("election_id", electionIds);

  if (ballotError) {
    throw ballotError;
  }

  /*
    |--------------------------------------------------------------------------
    | Batch Load Positions
    |--------------------------------------------------------------------------
    */

  const { data: positions, error: positionError } = await supabase
    .from("positions")
    .select(
      `
            id,
            election_id,
            title,
            display_order
        `,
    )
    .in("election_id", electionIds);

  if (positionError) {
    throw positionError;
  }

  /*
    |--------------------------------------------------------------------------
    | Batch Load Candidates
    |--------------------------------------------------------------------------
    */

  const { data: candidates, error: candidateError } = await supabase
    .from("candidates")
    .select(
      `
            id,
            election_id,
            position_id,
            full_name,
            is_active
        `,
    )
    .in("election_id", electionIds);

  if (candidateError) {
    throw candidateError;
  }

  /*
    |--------------------------------------------------------------------------
    | Recent Audit Logs
    |--------------------------------------------------------------------------
    */

  const { data: auditLogs, error: auditError } = await supabase
    .from("audit_logs")
    .select(
      `
            action,
            description,
            metadata,
            created_at
        `,
    )
    .order("created_at", {
      ascending: false,
    })
    .limit(20);

  if (auditError) {
    throw auditError;
  }

  /*
    |--------------------------------------------------------------------------
    | Group Loaded Data
    |--------------------------------------------------------------------------
    */

  const ballotsByElection = groupBy(ballots, "election_id");

  const positionsByElection = groupBy(positions, "election_id");

  const candidatesByElection = groupBy(candidates, "election_id");

  /*
    |--------------------------------------------------------------------------
    | Current Election Collections
    |--------------------------------------------------------------------------
    */

  const currentBallots = ballotsByElection[election.id] ?? [];

  const currentPositions = positionsByElection[election.id] ?? [];

  const currentCandidates = candidatesByElection[election.id] ?? [];

  /*
    |--------------------------------------------------------------------------
    | ==========================================================================
    | CURRENT ELECTION ANALYTICS
    | ==========================================================================
    */

  /*
    |--------------------------------------------------------------------------
    | Basic Counts
    |--------------------------------------------------------------------------
    */

  const ballotsSubmitted = currentBallots.length;

  const totalPositions = currentPositions.length;

  const totalCandidates = currentCandidates.filter((c) => c.is_active).length;

  const studentsYetToVote = Math.max(eligibleStudents - ballotsSubmitted, 0);

  const turnoutPercentage = percentage(ballotsSubmitted, eligibleStudents);

  /*
    |--------------------------------------------------------------------------
    | Candidate Competition
    |--------------------------------------------------------------------------
    */

  const candidatesPerPosition = {};

  currentCandidates.forEach((candidate) => {
    if (!candidate.is_active) return;

    if (!candidatesPerPosition[candidate.position_id]) {
      candidatesPerPosition[candidate.position_id] = [];
    }

    candidatesPerPosition[candidate.position_id].push(candidate);
  });

  const contestedPositions = [];

  const uncontestedPositions = [];

  currentPositions.forEach((position) => {
    const positionCandidates = candidatesPerPosition[position.id] ?? [];

    if (positionCandidates.length <= 1) {
      uncontestedPositions.push({
        id: position.id,

        title: position.title,

        candidateCount: positionCandidates.length,
      });
    } else {
      contestedPositions.push({
        id: position.id,

        title: position.title,

        candidateCount: positionCandidates.length,
      });
    }
  });

  const averageCandidatesPerPosition = round(
    divide(totalCandidates, totalPositions),
  );

  /*
    |--------------------------------------------------------------------------
    | Election Timing
    |--------------------------------------------------------------------------
    */

  const now = new Date();

  const startTime = new Date(election.start_time);

  const endTime = new Date(election.end_time);

  const totalDurationMilliseconds = endTime.getTime() - startTime.getTime();

  const elapsedMilliseconds = Math.max(0, now.getTime() - startTime.getTime());

  const electionProgress = round(
    Math.min(
      100,

      divide(elapsedMilliseconds, totalDurationMilliseconds) * 100,
    ),
  );

  const remainingHours = round(
    Math.max(
      0,

      (endTime.getTime() - now.getTime()) / 3600000,
    ),
  );

  const elapsedHours = Math.max(elapsedMilliseconds / 3600000, 1 / 60);

  /*
    |--------------------------------------------------------------------------
    | Voting Velocity
    |--------------------------------------------------------------------------
    */

  const averageVotesPerHour = round(divide(ballotsSubmitted, elapsedHours));

  const averageVotesPerMinute = round(divide(averageVotesPerHour, 60));

  /*
    |--------------------------------------------------------------------------
    | Recent Voting Activity
    |--------------------------------------------------------------------------
    */

  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

  const ballotsLastHour = currentBallots.filter(
    (ballot) => new Date(ballot.submitted_at) >= oneHourAgo,
  ).length;

  const ballotsLast30Minutes = currentBallots.filter(
    (ballot) => new Date(ballot.submitted_at) >= thirtyMinutesAgo,
  ).length;

  const ballotsLast10Minutes = currentBallots.filter(
    (ballot) => new Date(ballot.submitted_at) >= tenMinutesAgo,
  ).length;

  /*
    |--------------------------------------------------------------------------
    | Activity Level
    |--------------------------------------------------------------------------
    */

  let activityLevel = "Low";

  if (ballotsLastHour >= 100) {
    activityLevel = "Very High";
  } else if (ballotsLastHour >= 50) {
    activityLevel = "High";
  } else if (ballotsLastHour >= 20) {
    activityLevel = "Moderate";
  }

  /*
    |--------------------------------------------------------------------------
    | Participation Level
    |--------------------------------------------------------------------------
    */

  let participationLevel = "Low";

  if (turnoutPercentage >= 75) {
    participationLevel = "Excellent";
  } else if (turnoutPercentage >= 60) {
    participationLevel = "High";
  } else if (turnoutPercentage >= 40) {
    participationLevel = "Moderate";
  }

  /*
    |--------------------------------------------------------------------------
    | Competition Level
    |--------------------------------------------------------------------------
    */

  let competitionLevel = "Low";

  if (averageCandidatesPerPosition >= 4) {
    competitionLevel = "Very Competitive";
  } else if (averageCandidatesPerPosition >= 2.5) {
    competitionLevel = "Competitive";
  } else if (averageCandidatesPerPosition >= 1.5) {
    competitionLevel = "Moderate";
  }

  /*
    |--------------------------------------------------------------------------
    | Current Election Snapshot
    |--------------------------------------------------------------------------
    */

  const currentAnalytics = {
    ballotsSubmitted,

    eligibleStudents,

    studentsYetToVote,

    turnoutPercentage,

    participationLevel,

    totalPositions,

    totalCandidates,

    averageCandidatesPerPosition,

    contestedPositions,

    uncontestedPositions,

    competitionLevel,

    electionProgress,

    remainingHours,

    averageVotesPerHour,

    averageVotesPerMinute,

    ballotsLastHour,

    ballotsLast30Minutes,

    ballotsLast10Minutes,

    activityLevel,
  };

  /*
    |--------------------------------------------------------------------------
    | ==========================================================================
    | HISTORICAL ANALYTICS
    | ==========================================================================
    */

  const historicalRecords = [];

  previousElections.forEach((previous) => {
    const electionBallots = ballotsByElection[previous.id] ?? [];

    const electionPositions = positionsByElection[previous.id] ?? [];

    const electionCandidates = candidatesByElection[previous.id] ?? [];

    const durationHours = calculateDurationHours(
      previous.start_time,
      previous.end_time,
    );

    const turnout = percentage(electionBallots.length, eligibleStudents);

    const candidatesPerPosition = round(
      divide(electionCandidates.length, electionPositions.length),
    );

    const votesPerHour = round(divide(electionBallots.length, durationHours));

    historicalRecords.push({
      electionId: previous.id,

      title: previous.title,

      turnout,

      durationHours,

      candidatesPerPosition,

      votesPerHour,
    });
  });

  const turnoutHistory = historicalRecords.map((r) => r.turnout);

  const durationHistory = historicalRecords.map((r) => r.durationHours);

  const competitionHistory = historicalRecords.map(
    (r) => r.candidatesPerPosition,
  );

  const votingRateHistory = historicalRecords.map((r) => r.votesPerHour);

  const averageTurnout = round(average(turnoutHistory));

  const averageDuration = round(average(durationHistory));

  const averageCompetition = round(average(competitionHistory));

  const averageVotingRate = round(average(votingRateHistory));

  const bestTurnout = turnoutHistory.length ? Math.max(...turnoutHistory) : 0;

  const lowestTurnout = turnoutHistory.length ? Math.min(...turnoutHistory) : 0;

  const turnoutTrend = detectTrend(turnoutHistory);

  const participationTrend = detectTrend(votingRateHistory);

  const competitionTrend = detectTrend(competitionHistory);

  const turnoutDifference = round(
    currentAnalytics.turnoutPercentage - averageTurnout,
  );

  let turnoutPerformance = "Average";

  if (turnoutDifference >= 10) {
    turnoutPerformance = "Significantly Above Average";
  } else if (turnoutDifference >= 5) {
    turnoutPerformance = "Above Average";
  } else if (turnoutDifference <= -10) {
    turnoutPerformance = "Significantly Below Average";
  } else if (turnoutDifference <= -5) {
    turnoutPerformance = "Below Average";
  }

  const competitionDifference = round(
    currentAnalytics.averageCandidatesPerPosition - averageCompetition,
  );

  let competitionPerformance = "Average";

  if (competitionDifference > 0.5) {
    competitionPerformance = "More Competitive";
  } else if (competitionDifference < -0.5) {
    competitionPerformance = "Less Competitive";
  }

  const activityDifference = round(
    currentAnalytics.averageVotesPerHour - averageVotingRate,
  );

  let activityPerformance = "Average";

  if (activityDifference > 20) {
    activityPerformance = "Higher Than Historical";
  } else if (activityDifference < -20) {
    activityPerformance = "Lower Than Historical";
  }

  const historicalAnalytics = {
    previousElectionCount: historicalRecords.length,

    averageTurnout,

    bestTurnout,

    lowestTurnout,

    averageDurationHours: averageDuration,

    averageCandidatesPerPosition: averageCompetition,

    averageVotesPerHour: averageVotingRate,

    turnoutTrend,

    participationTrend,

    competitionTrend,

    turnoutDifference,

    turnoutPerformance,

    competitionDifference,

    competitionPerformance,

    activityDifference,

    activityPerformance,

    historicalRecords,
  };

  /*
    |--------------------------------------------------------------------------
    | ==========================================================================
    | ELECTION HEALTH
    | ==========================================================================
    */

  let healthScore = 100;

  if (currentAnalytics.turnoutPercentage < 60) {
    healthScore -= 15;
  }

  if (currentAnalytics.turnoutPercentage < 40) {
    healthScore -= 15;
  }

  if (currentAnalytics.averageCandidatesPerPosition < 2) {
    healthScore -= 10;
  }

  if (currentAnalytics.uncontestedPositions.length > 0) {
    healthScore -= currentAnalytics.uncontestedPositions.length * 2;
  }

  if (
    currentAnalytics.ballotsLastHour < 10 &&
    currentAnalytics.electionProgress < 90
  ) {
    healthScore -= 10;
  }

  if (historicalAnalytics.turnoutDifference < -10) {
    healthScore -= 15;
  }

  healthScore = Math.max(0, Math.min(100, healthScore));

  let healthStatus = "Critical";

  if (healthScore >= 90) {
    healthStatus = "Excellent";
  } else if (healthScore >= 75) {
    healthStatus = "Healthy";
  } else if (healthScore >= 60) {
    healthStatus = "Fair";
  } else if (healthScore >= 40) {
    healthStatus = "Poor";
  }

  const electionHealth = {
    score: healthScore,

    status: healthStatus,
  };

  /*
|--------------------------------------------------------------------------
| ==========================================================================
| RISK INTELLIGENCE
| ==========================================================================
*/

  const riskIndicators = [];

  if (currentAnalytics.turnoutPercentage < 40) {
    riskIndicators.push({
      type: "Low Turnout",

      severity: "High",

      description:
        "Current voter turnout is critically below the expected participation level.",
    });
  }

  if (historicalAnalytics.turnoutDifference < -10) {
    riskIndicators.push({
      type: "Declining Participation",

      severity: "Medium",

      description:
        "Current turnout is significantly below the historical average.",
    });
  }

  if (currentAnalytics.averageCandidatesPerPosition < 2) {
    riskIndicators.push({
      type: "Low Competition",

      severity: "Medium",

      description: "Several positions have very few candidates.",
    });
  }

  if (currentAnalytics.uncontestedPositions.length > 0) {
    riskIndicators.push({
      type: "Uncontested Positions",

      severity: "Medium",

      description: `${currentAnalytics.uncontestedPositions.length} position(s) are uncontested.`,
    });
  }

  if (
    currentAnalytics.ballotsLastHour < 5 &&
    currentAnalytics.electionProgress < 90
  ) {
    riskIndicators.push({
      type: "Low Voting Activity",

      severity: "High",

      description: "Voting activity has slowed considerably.",
    });
  }

  if (
    currentAnalytics.remainingHours <= 1 &&
    currentAnalytics.turnoutPercentage < 60
  ) {
    riskIndicators.push({
      type: "Election Ending Soon",

      severity: "High",

      description:
        "Election is nearing completion while turnout remains below target.",
    });
  }

  const positiveIndicators = [];

  if (currentAnalytics.turnoutPercentage >= 75) {
    positiveIndicators.push("Voter participation is excellent.");
  }

  if (historicalAnalytics.turnoutDifference > 5) {
    positiveIndicators.push("Turnout exceeds historical average.");
  }

  if (currentAnalytics.averageCandidatesPerPosition >= 3) {
    positiveIndicators.push("Election competition is healthy.");
  }

  if (currentAnalytics.ballotsLastHour >= 50) {
    positiveIndicators.push("Voting activity remains strong.");
  }

  if (electionHealth.score >= 90) {
    positiveIndicators.push("Overall election health is excellent.");
  }

  const recommendations = [];

  if (currentAnalytics.turnoutPercentage < 50) {
    recommendations.push(
      "Increase voter awareness through announcements and reminders.",
    );
  }

  if (currentAnalytics.ballotsLastHour < 10) {
    recommendations.push(
      "Encourage eligible students to vote before the election closes.",
    );
  }

  if (currentAnalytics.uncontestedPositions.length > 0) {
    recommendations.push(
      "Review nomination procedures to improve candidate participation in future elections.",
    );
  }

  if (electionHealth.score > 90) {
    recommendations.push(
      "Continue monitoring the election to maintain current performance.",
    );
  }

  /*
    |--------------------------------------------------------------------------
    | ==========================================================================
    | AI CONTEXT
    | ==========================================================================
    */

  const intelligence = {
    election: {
      id: election.id,

      title: election.title,

      description: election.description,

      status: election.status,

      startTime: election.start_time,

      endTime: election.end_time,

      publishedAt: election.published_at,
    },

    current: currentAnalytics,

    historical: historicalAnalytics,

    health: electionHealth,

    riskIndicators,

    positiveIndicators,

    recommendations,

    auditLogs,
  };

  /*
    |--------------------------------------------------------------------------
    | Return Intelligence
    |--------------------------------------------------------------------------
    */

  return intelligence;
}
