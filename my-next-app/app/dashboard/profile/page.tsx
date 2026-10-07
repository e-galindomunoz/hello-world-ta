import { Suspense } from "react";
import Loading from "@/components/loading-state";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { ProfileSection } from "@/components/profile-section";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getUser();
  if (!user) redirect("/login");
  return <><header className="page-heading"><span className="eyebrow">Your profile</span><h1>Make it yours<span className="brand-dot">.</span></h1><p>A face to the name. A little taste of your sense of humor.</p></header><Suspense fallback={<Loading />}><ProfileSection userId={user.id} email={user.email ?? ""} /></Suspense></>;
}
