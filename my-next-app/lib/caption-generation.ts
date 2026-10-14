import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { FeedbackExamples } from "@/lib/gemini";

type Client = Awaited<ReturnType<typeof createClient>>;
export class CaptionInputError extends Error {}
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

function imageMimeType(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export function validCaptionImagePath(path: unknown, userId: string): path is string {
  if (typeof path !== "string" || path.length > 128) return false;
  const parts = path.split("/");
  return parts.length === 2 && parts[0] === userId && FILE_NAME.test(parts[1]);
}
export async function downloadCaptionImage(supabase: Client, imagePath: string, userId: string) {
  if (!validCaptionImagePath(imagePath, userId)) throw new CaptionInputError("Invalid photo path. Upload a photo from your account first.");
  const segments = imagePath.split("/");
  // Download under the caller's session; Storage RLS remains authoritative.
  const { data: image, error: downloadError } = await supabase.storage
    .from("generation-images")
    .download(imagePath);
  if (downloadError || !image) {
    throw new CaptionInputError("Unable to read your uploaded photo. It may be missing or inaccessible. Try again, or upload it again.");
  }
  if (image.size === 0 || image.size > MAX_IMAGE_BYTES) {
    throw new CaptionInputError("Choose a nonempty image no larger than 5 MiB.");
  }

  const bytes = Buffer.from(await image.arrayBuffer());
  const mimeType = imageMimeType(bytes);
  const expectedMime = segments[1].toLowerCase().endsWith(".jpg") ? "image/jpeg"
    : segments[1].toLowerCase().endsWith(".png") ? "image/png" : "image/webp";
  if (!mimeType || mimeType !== expectedMime || image.type.split(";")[0].toLowerCase() !== mimeType) {
    throw new CaptionInputError("This photo is not a supported JPEG, PNG, or WebP image. Please upload another photo.");
  }

  return { bytes, mimeType };
}

export async function loadHumorPreference(supabase: Client, userId: string): Promise<string | null> {
  const { data, error } = await supabase.from("profiles").select("humor_preference").eq("id", userId).single();
  if (error || !data || (data.humor_preference !== null && typeof data.humor_preference !== "string")) {
    throw new CaptionInputError("Unable to load your humor preference. Please try again.");
  }
  return data.humor_preference;
}

export async function loadFeedbackExamples(supabase: Client, userId: string, excludeGenerationId?: string): Promise<FeedbackExamples | undefined> {
  try {
    let query = supabase.from("creator_feedback").select("rating, caption_snapshot").eq("user_id", userId);
    // Exclude before LIMIT so this post does not displace other learned examples.
    if (excludeGenerationId) query = query.neq("generation_id", excludeGenerationId);
    const { data: rows, error } = await query.order("updated_at", { ascending: false }).limit(10);
    if (error) {
      console.error("Feedback history load failed", { code: error.code });
      return undefined;
    }
    const liked: string[] = [];
    const disliked: string[] = [];
    for (const row of rows ?? []) {
      if (typeof row.caption_snapshot !== "string" || !row.caption_snapshot) continue;
      if (row.rating === 1 && liked.length < 3) liked.push(row.caption_snapshot);
      if (row.rating === -1 && disliked.length < 2) disliked.push(row.caption_snapshot);
    }
    return liked.length || disliked.length ? { liked, disliked } : undefined;
  } catch { return undefined; }
}
