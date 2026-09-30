import { redirect } from "next/navigation";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getUser } from "@/lib/supabase/server";
import { Landing } from "@/components/landing";

export const dynamic = "force-dynamic";

export default async function Login() {
  if (await getUser()) redirect("/dashboard");
  const configured = Boolean(getSupabaseConfig() && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
  return <Landing configured={configured} login />;
}
