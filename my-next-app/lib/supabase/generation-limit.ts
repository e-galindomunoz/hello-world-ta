import "server-only";

import { createClient } from "./server";

export type DailyGenerationStatus =
  | { state: "unknown" }
  | { state: "ready"; used: boolean; generationDay: string; resetsAt: string };

// Read the database's calendar and reset instant; never derive a day in the app.
export async function readDailyGenerationStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<DailyGenerationStatus> {
  try {
    const { data, error } = await supabase.rpc("get_daily_generation_status")
      .select("used, generation_day, resets_at").single();
    if (error || !data || typeof data.used !== "boolean"
      || typeof data.generation_day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.generation_day)
      || typeof data.resets_at !== "string" || !Number.isFinite(Date.parse(data.resets_at))) {
      return { state: "unknown" };
    }
    return { state: "ready", used: data.used, generationDay: data.generation_day, resetsAt: data.resets_at };
  } catch {
    return { state: "unknown" };
  }
}

export async function loadDailyGenerationStatus(): Promise<DailyGenerationStatus> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return { state: "unknown" };
    return readDailyGenerationStatus(supabase);
  } catch {
    return { state: "unknown" };
  }
}
