import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { GenerationImageUpload } from "@/components/generation-image-upload";
import { loadDailyGenerationStatus } from "@/lib/supabase/generation-limit";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await getUser();
  if (!user) redirect("/login");
  const dailyStatus = await loadDailyGenerationStatus();

  return <GenerationImageUpload initialDailyStatus={dailyStatus} />;
}
