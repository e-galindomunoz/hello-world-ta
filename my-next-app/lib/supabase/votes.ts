import "server-only";

import { createClient } from "./server";

export type VoteValue = 1 | -1 | null;
export type OwnVotes =
  | { status: "anonymous" }
  | { status: "error" }
  | { status: "ready"; votes: Record<string, 1 | -1> };

// Request-scoped only: never cache personalized vote data across viewers.
export async function loadOwnVotes(generationIds: string[]): Promise<OwnVotes> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError?.name === "AuthSessionMissingError") return { status: "anonymous" };
    if (authError) return { status: "error" };
    if (!user) return { status: "anonymous" };
    if (!generationIds.length) return { status: "ready", votes: {} };

    const { data, error } = await supabase.from("votes")
      .select("generation_id, value")
      .eq("user_id", user.id)
      .in("generation_id", generationIds);
    if (error || !data) return { status: "error" };
    const votes: Record<string, 1 | -1> = {};
    for (const row of data) {
      if (row.value !== 1 && row.value !== -1) return { status: "error" };
      votes[row.generation_id] = row.value;
    }
    return { status: "ready", votes };
  } catch {
    return { status: "error" };
  }
}
