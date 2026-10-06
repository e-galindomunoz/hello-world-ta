import { Suspense } from "react";
import Loading from "@/components/loading-state";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { Icon } from "@/components/icons";
import { ProfileSection } from "@/components/profile-section";
import { GenerationImageUpload } from "@/components/generation-image-upload";
import { loadDailyGenerationStatus } from "@/lib/supabase/generation-limit";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await getUser();
  if (!user) redirect("/login");
  const dailyStatus = await loadDailyGenerationStatus();

  return (
    <>
      <header className="page-heading dashboard-heading"><div><span className="eyebrow">A LITTLE EVERYDAY DELIGHT</span><h1>Welcome to your space<span className="brand-dot">.</span></h1><p>Your favorite finds, all in one place. Make yourself at home.</p></div><Link href="/dashboard/profile" className="button secondary"><Icon name="user" /> Your profile</Link></header>
      <Suspense fallback={<Loading />}><ProfileSection userId={user.id} email={user.email ?? ""} completionOnly /></Suspense>
      <GenerationImageUpload initialDailyStatus={dailyStatus} />
    </>
  );
}
