"use server";

import { createClient } from "@/lib/supabase/server";
import { CAPTION_PROMPT, generateImageCaption, GeminiCaptionError } from "@/lib/gemini";

type GenerationResult =
  | { ok: true; generation: { id: string; caption: string } }
  | { ok: false; message: string };

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
      return { ok: false, message: "Your session has expired. Sign in again before generating a caption." };
    }

    if (typeof imagePath !== "string" || imagePath.length > 128) {
      return { ok: false, message: "Invalid photo path. Upload a photo from your account first." };
    }
    const segments = imagePath.split("/");
    if (segments.length !== 2 || segments[0] !== user.id || !FILE_NAME.test(segments[1])) {
      return { ok: false, message: "Invalid photo path. Upload a photo from your account first." };
    }

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
    const caption = await generateImageCaption(bytes, mimeType);

    stage = "save";
    // Never insert a placeholder. This exact prompt was sent to Gemini.
    const { data: generation, error: insertError } = await supabase
      .from("generations")
      .insert({ user_id: user.id, image_path: imagePath, prompt: CAPTION_PROMPT, caption })
      .select("id, caption")
      .single();
    if (insertError || !generation) {
      console.error("Caption save failed", { code: insertError?.code });
      return { ok: false, message: "Gemini produced a caption, but saving could not be confirmed. Retrying generates a new caption and may create another saved result." };
    }
    return { ok: true, generation: { id: generation.id, caption: generation.caption } };
  } catch (error) {
    if (error instanceof GeminiCaptionError) return { ok: false, message: error.message };
    // Do not log SDK errors, credentials, sessions, image bytes, or prompt data.
    console.error("Caption action failed", { stage, type: error instanceof Error ? error.name : typeof error });
    return { ok: false, message: stage === "save"
      ? "Saving could not be confirmed. Retrying generates a new caption and may create another saved result."
      : "Unable to generate a caption right now. Your uploaded photo is still available; please try again." };
  }
}
