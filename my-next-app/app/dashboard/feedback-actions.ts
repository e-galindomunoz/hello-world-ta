"use server";

import { createClient } from "@/lib/supabase/server";
import { isGenerationId } from "@/lib/supabase/feed-images";

export type FeedbackRating = 1 | -1 | null;

type FeedbackResult =
  | { ok: true; rating: FeedbackRating; captionAttempt: 1 | 2 }
  | { ok: false; code: "auth" | "invalid" | "uncertain" | "unavailable" | "stale"; message: string };

export async function submitCreatorFeedback(
  generationId: unknown,
  rating: unknown,
  expectedAttempt: unknown,
): Promise<FeedbackResult> {
  if (
    typeof generationId !== "string" ||
    !isGenerationId(generationId) ||
    (expectedAttempt !== 1 && expectedAttempt !== 2) ||
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

    writing = true;
    const { data, error } = await supabase.rpc("set_creator_caption_feedback", {
      p_generation_id: generationId,
      p_expected_attempt: expectedAttempt,
      p_rating: rating,
    });
    if (error?.message === "caption_attempt_changed") {
      return { ok: false, code: "stale", message: "Your caption changed. Check it before leaving feedback." };
    }
    if (error || !data || data.rating !== rating || data.caption_attempt !== expectedAttempt) {
      throw new Error("Feedback save was not confirmed.");
    }
    return { ok: true, rating, captionAttempt: expectedAttempt };
  } catch {
    return writing
      ? {
          ok: false,
          code: "uncertain",
          message: "Saving could not be confirmed. Check your caption before trying again.",
        }
      : {
          ok: false,
          code: "unavailable",
          message: "Feedback is unavailable. Please try again.",
        };
  }
}
