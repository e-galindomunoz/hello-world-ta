import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

export function createClient() {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Missing Supabase environment variables.");
  // The SSR browser client stores the PKCE verifier in cookies for the callback.
  return createBrowserClient(config.url, config.key);
}
