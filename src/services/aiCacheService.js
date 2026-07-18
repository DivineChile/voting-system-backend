const ACTIVE_CACHE_MINUTES = 5;

/*
|--------------------------------------------------------------------------
| Get Cached Insight
|--------------------------------------------------------------------------
*/

export async function getCachedInsight(supabase, electionId) {
  const { data, error } = await supabase
    .from("ai_election_insights")
    .select("*")
    .eq("election_id", electionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/*
|--------------------------------------------------------------------------
| Save New Insight
|--------------------------------------------------------------------------
*/

export async function saveCachedInsight(supabase, report) {
  const { error } = await supabase.from("ai_election_insights").insert(report);

  if (error) {
    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| Update Existing Insight
|--------------------------------------------------------------------------
*/

export async function updateCachedInsight(supabase, electionId, report) {
  const { error } = await supabase
    .from("ai_election_insights")
    .update({
      ...report,

      updated_at: new Date().toISOString(),
    })
    .eq("election_id", electionId);

  if (error) {
    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| Cache Expiration
|--------------------------------------------------------------------------
*/

export function isCacheExpired(generatedAt) {
  if (!generatedAt) {
    return true;
  }

  const generated = new Date(generatedAt).getTime();

  const now = Date.now();

  const age = now - generated;

  return age > ACTIVE_CACHE_MINUTES * 60 * 1000;
}
