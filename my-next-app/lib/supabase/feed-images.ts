import "server-only";

import { createPublicClient } from "./public";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

export function isGenerationId(value: string): boolean {
  return UUID.test(value);
}

export function isPublishedImagePath(path: unknown, userId: unknown): path is string {
  if (typeof path !== "string" || typeof userId !== "string" || !UUID.test(userId)) return false;
  const parts = path.split("/");
  return parts.length === 2 && parts[0] === userId && IMAGE_FILE.test(parts[1]);
}

type ImageResult = { status: 200; url: string } | { status: 404 | 503 };

export async function getPublishedImageUrl(id: string): Promise<ImageResult> {
  if (!isGenerationId(id)) return { status: 404 };
  try {
    const supabase = createPublicClient();
    const { data: generation, error } = await supabase.from("generations")
      .select("id, user_id, image_path")
      .eq("id", id)
      .maybeSingle();
    if (error) return { status: 503 };
    if (!generation || !isPublishedImagePath(generation.image_path, generation.user_id)) {
      return { status: 404 };
    }

    // Storage SELECT RLS independently checks the exact published path and owner.
    const { data, error: signingError } = await supabase.storage
      .from("generation-images")
      .createSignedUrl(generation.image_path, 60);
    if (signingError || !data?.signedUrl) return { status: 503 };
    return { status: 200, url: data.signedUrl };
  } catch {
    // Do not expose upstream errors, paths, or signed tokens to error responses.
    return { status: 503 };
  }
}
