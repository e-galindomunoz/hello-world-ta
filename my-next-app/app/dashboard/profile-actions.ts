"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AVATAR_TOO_LARGE_MESSAGE, MAX_AVATAR_UPLOAD_BYTES } from "@/lib/image-upload";

export async function saveProfile(_previousState: { message: string }, formData: FormData) {
  const firstName = formData.get("first_name");
  const lastName = formData.get("last_name");
  if (typeof firstName !== "string" || typeof lastName !== "string" || !firstName.trim() || !lastName.trim()) {
    return { message: "Enter both your first and last name." };
  }

  const humorPreference = formData.get("humor_preference");
  if (typeof humorPreference !== "string" || humorPreference.trim().length > 500) {
    return { message: "Describe your humor in 500 characters or fewer." };
  }

  const photo = formData.get("avatar");
  const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  if (photo instanceof File && photo.size > 0) {
    if (!extensions[photo.type]) return { message: "Choose a JPEG, PNG, or WebP image." };
    if (photo.size > MAX_AVATAR_UPLOAD_BYTES) return { message: AVATAR_TOO_LARGE_MESSAGE };
  }

  try {
    const supabase = await createClient();
    // Derive ownership from the verified session, never from submitted form data.
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { message: "Your session has expired. Please sign in again." };

    const values: { first_name: string; last_name: string; humor_preference: string | null; avatar_url?: string } = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      humor_preference: humorPreference.trim() || null,
    };

    if (photo instanceof File && photo.size > 0) {
      const path = `${user.id}/${crypto.randomUUID()}.${extensions[photo.type]}`;
      const { error } = await supabase.storage.from("avatars").upload(path, photo, { contentType: photo.type });
      if (error) {
        // Log only diagnostic fields, not the session, image, or credentials.
        console.error("Avatar upload failed", {
          message: error.message,
          ...("statusCode" in error ? { statusCode: error.statusCode } : {}),
          ...("code" in error ? { code: error.code } : {}),
        });
        return { message: "Unable to upload your photo. Please try again. Your profile was not changed." };
      }
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      values.avatar_url = data.publicUrl;
    }

    const { data, error } = await supabase.from("profiles")
      .update(values)
      .eq("id", user.id)
      .select("id")
      .single();
    if (error || !data) return { message: "Unable to save your profile. Please try again. If you selected a photo, select it again." };
  } catch {
    return { message: "Unable to save your profile. Check your connection and try again. If you selected a photo, select it again." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  return { message: "Profile saved." };
}
