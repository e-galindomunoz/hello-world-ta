import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleSignIn } from "@/components/google-sign-in";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Login() {
  if (await getUser()) redirect("/dashboard");
  const configured = getSupabaseConfig() && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  return (
    <main className="shell">
      <Link href="/" className="back-link">← Home</Link>
      <section className="card">
        <span className="badge">Members only</span>
        <h1>Welcome back.</h1>
        <p>Continue with your Google account to open your dashboard.</p>
        {configured ? <GoogleSignIn /> : <p role="status">Sign-in is not available yet. Please check back after setup is complete.</p>}
      </section>
    </main>
  );
}
