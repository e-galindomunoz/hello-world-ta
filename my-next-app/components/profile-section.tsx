import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile-form";

async function loadProfile(userId: string) {
  try {
    const supabase = await createClient();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .eq("id", userId)
      .single();

    return error ? null : profile;
  } catch {
    return null;
  }
}

export async function ProfileSection({ userId, email, completionOnly = false }: { userId: string; email: string; completionOnly?: boolean }) {
  const profile = await loadProfile(userId);
  if (!profile) {
    return <section className="card glass profile-error" aria-label="Profile"><h2>Profile</h2><p role="status">Unable to load your profile. Please reload to try again.</p></section>;
  }

  const incomplete = profile.first_name === null || profile.last_name === null;
  if (completionOnly && !incomplete) return null;

  return (
    <section className="card glass profile-card" aria-label="Profile information">
      {incomplete && <div className="completion-banner"><strong>Let’s make this feel like you.</strong> Complete your profile by entering both your first and last name.</div>}
      <ProfileForm profile={profile} email={email} />
    </section>
  );
}
