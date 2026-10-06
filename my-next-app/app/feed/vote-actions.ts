"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { isGenerationId } from "@/lib/supabase/feed-images";
import type { VoteValue } from "@/lib/supabase/votes";

type VoteResult =
  | { ok: true; value: VoteValue }
  | { ok: false; code: "auth" | "invalid" | "unavailable" | "uncertain"; message: string };

export async function setVote(generationId: unknown, desiredValue: unknown): Promise<VoteResult> {
  if (typeof generationId !== "string" || generationId.length !== 36 || !isGenerationId(generationId)
    || (desiredValue !== 1 && desiredValue !== -1 && desiredValue !== null)) {
    return { ok: false, code: "invalid", message: "Invalid vote. Reload the feed and try again." };
  }

  let writing = false;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { ok: false, code: "auth", message: "Sign in to vote." };
    }

    // Verify publication as anon, independently of the caller's session.
    const { data: generation, error: generationError } = await createPublicClient()
      .from("generations").select("id").eq("id", generationId).maybeSingle();
    if (generationError || !generation) {
      return { ok: false, code: "unavailable", message: "This post is unavailable. Reload the feed and try again." };
    }

    if (desiredValue === null) {
      writing = true;
      const { error } = await supabase.from("votes").delete()
        .eq("generation_id", generationId).eq("user_id", user.id);
      if (error) {
        throw new Error("Vote removal was not confirmed.");
      }
    } else {
      const { data: existingVote, error: lookupError } = await supabase.from("votes")
        .select("generation_id, value")
        .eq("generation_id", generationId).eq("user_id", user.id)
        .maybeSingle();
      if (lookupError) {
        throw new Error("Unable to read current vote.");
      }

      // UPDATE is granted only on value. Never include either key in its payload.
      const updateValue = () => supabase.from("votes")
        .update({ value: desiredValue })
        .eq("generation_id", generationId).eq("user_id", user.id)
        .select("generation_id, value").single();

      writing = true;
      let result;
      if (existingVote) {
        result = await updateValue();
      } else {
        result = await supabase.from("votes")
          .insert({ generation_id: generationId, user_id: user.id, value: desiredValue })
          .select("generation_id, value").single();
        if (result.error?.code === "23505") {
          // Another request may have inserted this user's vote after our lookup.
          // Retry exactly once, changing only value on the same composite key.
          result = await updateValue();
        }
      }
      const { data, error } = result;
      if (error || !data || data.value !== desiredValue) throw new Error("Vote save was not confirmed.");
    }
    revalidatePath("/feed");
    return { ok: true, value: desiredValue };
  } catch {
    return writing
      ? { ok: false, code: "uncertain", message: "Saving could not be confirmed. Reload your vote before trying again." }
      : { ok: false, code: "unavailable", message: "Voting is unavailable. Reload the feed and try again." };
  }
}
