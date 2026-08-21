import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseConfig } from "./config";

let browserClient: SupabaseClient | null = null;

export function createClient():SupabaseClient {
  if (browserClient) return browserClient;
  const { url, key } = requireSupabaseConfig();
  browserClient = createBrowserClient(url, key);
  return browserClient;
}
