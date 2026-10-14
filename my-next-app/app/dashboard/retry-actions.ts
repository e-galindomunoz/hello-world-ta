"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isGenerationId } from "@/lib/supabase/feed-images";
import { CaptionInputError, downloadCaptionImage, loadFeedbackExamples, loadHumorPreference } from "@/lib/caption-generation";
import { buildCaptionPrompt, generateImageCaption, GeminiCaptionError } from "@/lib/gemini";

export type CreatorCaptionState = {
  id: string; caption: string; captionAttempt: 1 | 2;
  rating: 1 | -1 | null; retryAvailable: boolean;
};
type Failure = { ok: false; code: "unavailable" | "retry_not_available" | "uncertain"; message: string };
type StateResult = { ok: true; generation: CreatorCaptionState } | Failure;

async function readState(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data, error } = await supabase.rpc("get_creator_caption_state", { p_generation_id: id });
  if (error || !data || data.id !== id || typeof data.caption !== "string"
    || typeof data.image_path !== "string" || ![1, 2].includes(data.caption_attempt)
    || ![1, -1, null].includes(data.rating) || typeof data.retry_available !== "boolean") {
    throw new Error("Caption state unavailable");
  }
  return {
    generation: { id, caption: data.caption, captionAttempt: data.caption_attempt,
      rating: data.rating, retryAvailable: data.retry_available } as CreatorCaptionState,
    imagePath: data.image_path as string,
    reason: data.retry_reason as string | null,
  };
}

export async function refreshCreatorCaption(generationId: unknown): Promise<StateResult> {
  try {
    if (typeof generationId !== "string" || !isGenerationId(generationId)) throw new Error("Invalid ID");
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error("Authentication required");
    const { generation } = await readState(supabase, generationId);
    return { ok: true, generation };
  } catch {
    return { ok: false, code: "uncertain", message: "Couldn’t check your caption. Check again before making another change." };
  }
}

function unavailable(reason: string | null): Failure {
  return { ok: false, code: "retry_not_available", message: reason === "votes_exist"
    ? "The crowd already weighed in. This caption’s locked in."
    : "This shot’s no longer available. Check your caption for the latest." };
}

export async function retryCaption(generationId: unknown): Promise<StateResult> {
  let committing = false;
  try {
    if (typeof generationId !== "string" || !isGenerationId(generationId)) return unavailable(null);
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return { ok: false, code: "unavailable", message: "Sign in again to run it back." };
    const state = await readState(supabase, generationId);
    if (!state.generation.retryAvailable || state.generation.captionAttempt !== 1 || state.generation.rating !== -1) {
      return unavailable(state.reason);
    }
    const { bytes, mimeType } = await downloadCaptionImage(supabase, state.imagePath, user.id);
    const preference = await loadHumorPreference(supabase, user.id);
    const examples = await loadFeedbackExamples(supabase, user.id, generationId);
    const prompt = buildCaptionPrompt(preference, examples, state.generation.caption);
    const caption = await generateImageCaption(bytes, mimeType, prompt);
    committing = true;
    const { data, error: commitError } = await supabase.rpc("commit_caption_retry", {
      p_generation_id: generationId, p_caption: caption, p_prompt: prompt,
    });
    if (commitError?.message.startsWith("retry_not_available:")) {
      return unavailable(commitError.message.slice("retry_not_available:".length));
    }
    if (commitError || data?.id !== generationId || data?.caption !== caption || data?.caption_attempt !== 2) {
      throw new Error("Commit not confirmed");
    }
    revalidatePath("/feed");
    return { ok: true, generation: { id: generationId, caption, captionAttempt: 2, rating: null, retryAvailable: false } };
  } catch (error) {
    if (committing) {
      // A failed response does not prove rollback. Reconcile before another mutation.
      return { ok: false, code: "uncertain", message: "Couldn’t confirm that shot. Check your caption before trying again." };
    }
    return { ok: false, code: "unavailable", message: error instanceof GeminiCaptionError || error instanceof CaptionInputError
      ? error.message : "Couldn’t run it back right now. Your original caption is still here." };
  }
}
