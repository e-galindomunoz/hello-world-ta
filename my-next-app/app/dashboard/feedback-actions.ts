"use server";

import { createClient } from "@/lib/supabase/server";
import { isGenerationId } from "@/lib/supabase/feed-images";

export type FeedbackRating = 1 | -1 | null;

type FeedbackResult =
  | { ok: true; rating: FeedbackRating }
  | { ok: false; code: "auth" | "invalid" | "uncertain" | "unavailable"; message: string };

export async function submitCreatorFeedback(
  generationId: unknown,
  rating: unknown,
): Promise<FeedbackResult> {
  if (
    typeof generationId !== "string" ||
    !isGenerationId(generationId) ||
    (rating !== 1 && rating !== -1 && rating !== null)
  ) {
    return { ok: false, code: "invalid", message: "Invalid feedback. Reload and try again." };
  }

  let writing = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { ok: false, code: "auth", message: "Sign in to leave feedback." };
    }

    if (rating === null) {
      writing = true;
      const { error } = await supabase
        .from("creator_feedback")
        .delete()
        .eq("generation_id", generationId)
        .eq("user_id", user.id);
      if (error) throw new Error("Feedback removal was not confirmed.");
      return { ok: true, rating: null };
    }

    // INSERT first; on duplicate key (23505) retry as UPDATE on rating only.
    // The column-level grant permits UPDATE on rating only; updated_at is
    // maintained by the database trigger and must not appear in this payload.
    writing = true;
    let result = await supabase
      .from("creator_feedback")
      .insert({ generation_id: generationId, user_id: user.id, rating })
      .select("generation_id, rating")
      .single();

    if (result.error?.code === "23505") {
      result = await supabase
        .from("creator_feedback")
        .update({ rating })
        .eq("generation_id", generationId)
        .eq("user_id", user.id)
        .select("generation_id, rating")
        .single();
    }

    const { data, error } = result;
    if (error || !data || data.rating !== rating) {
      throw new Error("Feedback save was not confirmed.");
    }
    return { ok: true, rating };
  } catch {
    return writing
      ? {
          ok: false,
          code: "uncertain",
          message: "Saving could not be confirmed. Reload before trying again.",
        }
      : {
          ok: false,
          code: "unavailable",
          message: "Feedback is unavailable. Please try again.",
        };
  }
}
