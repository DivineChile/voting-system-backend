export async function getAvailableElectionIntelligence(supabase) {
  const { data, error } = await supabase
    .from("elections")
    .select(
      `
      id,
      title,
      status,
      start_time,
      end_time,
      published_at
    `,
    )
    .in("status", ["active", "published", "closed"])
    .order("start_time", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}
