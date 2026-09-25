import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export default async function Dashboard() {
  const user = await getUser();
  if (!user) redirect("/login");
  let rows: Record<string, unknown>[] = [];
  let message = "";

  try {
    // The user is verified before any table data is requested.
    const supabase = await createClient();
    const { data, error } = await supabase.from("coffee").select("*").limit(100);
    if (error) {
      message = "Unable to load the table. Check the connection and existing read permissions.";
    } else {
      rows = data ?? [];
      if (!rows.length) message = "No rows are available to display.";
    }
  } catch {
    message = "Unable to connect to the database. Please try again later.";
  }

  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return (
    <main className="shell table-shell">
      <Link href="/" className="back-link">← Home</Link>
      <section className="card">
        <span className="badge">Access granted</span>
        <h1>Your coffee collection.</h1>
        <p>Signed in as <strong>{user.email}</strong>.</p>
        <form action={signOut}><button className="button secondary" type="submit">Sign out</button></form>
        {message ? <p role="status">{message}</p> : (
          <>
            <p>{rows.length} {rows.length === 1 ? "row" : "rows"} shown (up to 100).</p>
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Database rows">
              <table>
                <caption>coffee</caption>
                <thead><tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
                <tbody>{rows.map((row, index) => (
                  <tr key={index}>{columns.map((column) => <td key={column}>{displayValue(row[column])}</td>)}</tr>
                ))}</tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
