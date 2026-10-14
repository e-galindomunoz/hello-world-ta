"use server";

import { createClient } from "@/lib/supabase/server";
import { buildCaptionPrompt, generateImageCaption, GeminiCaptionError } from "@/lib/gemini";
import { loadDailyGenerationStatus, readDailyGenerationStatus, type DailyGenerationStatus } from "@/lib/supabase/generation-limit";

import { CaptionInputError, validCaptionImagePath, downloadCaptionImage, loadHumorPreference, loadFeedbackExamples } from "@/lib/caption-generation";

type GenerationResult =
  | { ok: true; generation: { id: string; caption: string; captionAttempt: 1 }; dailyStatus: DailyGenerationStatus }
  | { ok: false; message: string; code?: "daily_limit"; dailyStatus?: DailyGenerationStatus };

export async function checkGenerationAvailability(): Promise<DailyGenerationStatus> {
  return loadDailyGenerationStatus();
}

export async function generateCaption(imagePath: unknown): Promise<GenerationResult> {
  let stage = "authentication";
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { ok: false, message: "Your session has expired. Sign in again before generating a caption.", dailyStatus: { state: "unknown" } };
    }

    if (!validCaptionImagePath(imagePath, user.id)) {
      return { ok: false, message: "Invalid photo path. Upload a photo from your account first." };
    }

    stage = "daily availability";
    const dailyStatus = await readDailyGenerationStatus(supabase);
    if (dailyStatus.state === "unknown") {
      return { ok: false, message: "Unable to check today's availability. Check availability before trying again.", dailyStatus };
    }
    if (dailyStatus.used) {
      return { ok: false, code: "daily_limit", message: "Today's generation is already used. It resets at midnight New York time.", dailyStatus };
    }

    stage = "humor preference";
    const preference = await loadHumorPreference(supabase, user.id);
    const feedbackExamples = await loadFeedbackExamples(supabase, user.id);
    const prompt = buildCaptionPrompt(preference, feedbackExamples);
    stage = "download";
    const { bytes, mimeType } = await downloadCaptionImage(supabase, imagePath, user.id);

    stage = "generation";
    const caption = await generateImageCaption(bytes, mimeType, prompt);

    stage = "save";
    // Never insert a placeholder. This exact prompt was sent to Gemini.
    const { data: generation, error: insertError } = await supabase
      .from("generations")
      .insert({ user_id: user.id, image_path: imagePath, prompt, caption })
      .select("id, caption")
      .single();
    if (insertError || !generation) {
      if (insertError?.code === "P0001" && insertError.message === "daily_generation_limit_reached") {
        return { ok: false, code: "daily_limit", message: "Another request used today's generation. Check availability for the next reset.", dailyStatus: await readDailyGenerationStatus(supabase) };
      }
      console.error("Caption save failed", { code: insertError?.code });
      return { ok: false, message: "Gemini produced a caption, but saving could not be confirmed. Check availability before trying again.", dailyStatus: { state: "unknown" } };
    }
    // Re-read after commit, including requests that crossed New York midnight.
    return { ok: true, generation: { id: generation.id, caption: generation.caption, captionAttempt: 1 }, dailyStatus: await readDailyGenerationStatus(supabase) };
  } catch (error) {
    if (error instanceof GeminiCaptionError || error instanceof CaptionInputError) return { ok: false, message: error.message };
    // Do not log SDK errors, credentials, sessions, image bytes, or prompt data.
    console.error("Caption action failed", { stage, type: error instanceof Error ? error.name : typeof error });
    return { ok: false, message: stage === "save"
      ? "Saving could not be confirmed. Check availability before trying again."
      : "Unable to generate a caption right now. Your uploaded photo is still available; please try again.",
      dailyStatus: { state: "unknown" } };
  }
}
