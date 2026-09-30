import { getUser } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { Landing } from "@/components/landing";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getUser();
  const configured = Boolean(getSupabaseConfig());
  return <Landing signedIn={Boolean(user)} configured={configured} />;
}
