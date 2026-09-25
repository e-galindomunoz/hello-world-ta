import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getUser();
  return (
    <main className="shell">
      <section className="card">
        <span className="badge">Coffee collection</span>
        <h1>Find your next<br />favorite roast.</h1>
        {user ? (
          <>
            <p>Welcome back, {user.email}. Your coffee collection is ready.</p>
            <div className="actions">
              <Link href="/dashboard" className="button">View coffee table →</Link>
              <form action={signOut}><button className="button secondary" type="submit">Sign out</button></form>
            </div>
          </>
        ) : (
          <>
            <p>Sign in with Google to view the coffee collection.</p>
            <Link href="/login" className="button">Sign in to continue →</Link>
          </>
        )}
      </section>
    </main>
  );
}
