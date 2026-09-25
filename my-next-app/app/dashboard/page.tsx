import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await getUser();
  if (!user) redirect("/login");
  return (
    <main className="shell">
      <Link href="/" className="back-link">← Home</Link>
      <section className="card">
        <span className="badge">Access granted</span>
        <h1>Your dashboard.</h1>
        <p>Signed in as <strong>{user.email}</strong>.</p>
        <div className="member-content">
          <h2>Hello, member.</h2>
          <p>You unlocked this space by signing in. This content is only available to authenticated users.</p>
        </div>
        <form action={signOut}><button className="button secondary" type="submit">Sign out</button></form>
      </section>
    </main>
  );
}
