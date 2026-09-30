import { Suspense } from "react";
import Loading from "@/components/loading-state";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { Icon } from "@/components/icons";
import { ProfileSection } from "@/components/profile-section";

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
    <>
      <header className="page-heading dashboard-heading"><div><span className="eyebrow">A LITTLE EVERYDAY DELIGHT</span><h1>Welcome to your space<span className="brand-dot">.</span></h1><p>Your favorite finds, all in one place. Make yourself at home.</p></div><Link href="/dashboard/profile" className="button secondary"><Icon name="user" /> Your profile</Link></header>
      <Suspense fallback={<Loading />}><ProfileSection userId={user.id} email={user.email ?? ""} completionOnly /></Suspense>
      <section className="card glass collection-card">
        <div className="collection-header"><div className="collection-title"><span className="section-icon"><Icon name="coffee" /></span><div><h2>Your coffee collection</h2><p>A good day starts with a great roast.</p></div></div><span className="badge">{rows.length} {rows.length === 1 ? "favorite" : "favorites"}</span></div>
        {message ? <div className="empty-state" role="status"><Icon name="coffee" /><p>{message}</p></div> : (
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Database rows">
            <table>
              <caption className="sr-only">Coffee collection</caption>
              <thead><tr>{columns.map((column) => <th key={column} scope="col">{column.replaceAll("_", " ")}</th>)}</tr></thead>
              <tbody>{rows.map((row, index) => (
                <tr key={index}>{columns.map((column) => <td key={column}>{displayValue(row[column])}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <div className="collection-footer"><span>Signed in as {user.email}</span><span>Showing up to 100 entries</span></div>
      </section>
    </>
  );
}
