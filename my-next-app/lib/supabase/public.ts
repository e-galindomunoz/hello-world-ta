import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

// Deliberately independent of cookies and authenticated clients: always anon.
export function createPublicClient() {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Missing Supabase public configuration.");
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
