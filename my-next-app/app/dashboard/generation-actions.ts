"use server";

import { createClient } from "@/lib/supabase/server";
import { buildCaptionPrompt, generateImageCaption, GeminiCaptionError, type FeedbackExamples } from "@/lib/gemini";
import { loadDailyGenerationStatus, readDailyGenerationStatus, type DailyGenerationStatus } from "@/lib/supabase/generation-limit";

type GenerationResult =
  | { ok: true; generation: { id: string; caption: string }; dailyStatus: DailyGenerationStatus }
  | { ok: false; message: string; code?: "daily_limit"; dailyStatus?: DailyGenerationStatus };

export async function checkGenerationAvailability(): Promise<DailyGenerationStatus> {
  return loadDailyGenerationStatus();
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

function imageMimeType(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function generateCaption(imagePath: unknown): Promise<GenerationResult> {
  let stage = "authentication";
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { ok: false, message: "Your session has expired. Sign in again before generating a caption.", dailyStatus: { state: "unknown" } };
    }

    if (typeof imagePath !== "string" || imagePath.length > 128) {
      return { ok: false, message: "Invalid photo path. Upload a photo from your account first." };
    }
    const segments = imagePath.split("/");
    if (segments.length !== 2 || segments[0] !== user.id || !FILE_NAME.test(segments[1])) {
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
    const { data: profile, error: profileError } = await supabase.from("profiles")
      .select("humor_preference").eq("id", user.id).single();
    if (profileError || !profile || (profile.humor_preference !== null && typeof profile.humor_preference !== "string")) {
      return { ok: false, message: "Unable to load your humor preference. Please try again. Your daily generation has not been used." };
    }
    // Best-effort: load recent feedback for prompt personalization.
    // A load failure must never block an otherwise valid generation.
    let feedbackExamples: FeedbackExamples | undefined;
    try {
      const { data: rows, error: feedbackError } = await supabase
        .from("creator_feedback")
        .select("rating, generations(caption)")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(10);
      if (feedbackError) {
        console.error("Feedback history load failed", { code: feedbackError.code });
      } else if (Array.isArray(rows)) {
        const liked: string[] = [];
        const disliked: string[] = [];
        for (const row of rows) {
          // PostgREST may type the embedded resource as an array or single object
          // depending on whether the client has generated types; handle both at runtime.
          const gen = row.generations as { caption?: unknown }[] | { caption?: unknown } | null;
          const rawCaption = Array.isArray(gen) ? gen[0]?.caption : gen?.caption;
          const caption = typeof rawCaption === "string" ? rawCaption : null;
          if (!caption) continue;
          if (row.rating === 1 && liked.length < 3) liked.push(caption);
          else if (row.rating === -1 && disliked.length < 2) disliked.push(caption);
        }
        if (liked.length > 0 || disliked.length > 0) feedbackExamples = { liked, disliked };
      }
    } catch {
      // Feedback load failure must never block generation.
    }
    const prompt = buildCaptionPrompt(profile.humor_preference, feedbackExamples);

    stage = "download";
    // Download under the caller's session; Storage RLS remains authoritative.
    const { data: image, error: downloadError } = await supabase.storage
      .from("generation-images")
      .download(imagePath);
    if (downloadError || !image) {
      return { ok: false, message: "Unable to read your uploaded photo. It may be missing or inaccessible. Try again, or upload it again." };
    }
    if (image.size === 0 || image.size > MAX_IMAGE_BYTES) {
      return { ok: false, message: "Choose a nonempty image no larger than 5 MiB." };
    }

    const bytes = Buffer.from(await image.arrayBuffer());
    const mimeType = imageMimeType(bytes);
    const expectedMime = segments[1].toLowerCase().endsWith(".jpg") ? "image/jpeg"
      : segments[1].toLowerCase().endsWith(".png") ? "image/png" : "image/webp";
    if (!mimeType || mimeType !== expectedMime || image.type.split(";")[0].toLowerCase() !== mimeType) {
      return { ok: false, message: "This photo is not a supported JPEG, PNG, or WebP image. Please upload another photo." };
    }

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
    return { ok: true, generation: { id: generation.id, caption: generation.caption }, dailyStatus: await readDailyGenerationStatus(supabase) };
  } catch (error) {
    if (error instanceof GeminiCaptionError) return { ok: false, message: error.message };
    // Do not log SDK errors, credentials, sessions, image bytes, or prompt data.
    console.error("Caption action failed", { stage, type: error instanceof Error ? error.name : typeof error });
    return { ok: false, message: stage === "save"
      ? "Saving could not be confirmed. Check availability before trying again."
      : "Unable to generate a caption right now. Your uploaded photo is still available; please try again.",
      dailyStatus: { state: "unknown" } };
  }
}
