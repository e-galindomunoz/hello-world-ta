import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export default async function Home() {
  const config = getSupabaseConfig();
  const table = process.env.SUPABASE_TABLE;
  let rows: Record<string, unknown>[] = [];
  let message = "";

  if (!config || !table) {
    message = "The database connection is not configured yet.";
  } else {
    try {
      // Always read as anon, independent of any existing Google login cookies.
      const supabase = createClient(config.url, config.key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data, error } = await supabase.from(table).select("*").limit(100);
      if (error) {
        message = "Unable to load the table. Check the connection, table name, and existing read permissions.";
      } else {
        rows = data ?? [];
        if (!rows.length) message = "No rows are available to display.";
      }
    } catch {
      message = "Unable to connect to the database. Please try again later.";
    }
  }

  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return (
    <main className="shell table-shell">
      <section className="card">
        <span className="badge">Supabase</span>
        <h1>Database table.</h1>
        {message ? <p role="status">{message}</p> : (
          <>
            <p>{rows.length} {rows.length === 1 ? "row" : "rows"} shown (up to 100).</p>
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Database rows">
              <table>
                <caption>{table}</caption>
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
