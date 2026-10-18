import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/**
 * Browser Supabase client (singleton). The session is stored in cookies by `@supabase/ssr`, so the Next
 * middleware and route handlers see the same session; the browser refreshes the access token automatically.
 */
export function getSupabase(): SupabaseClient {
    if (client) return client;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required");

    client = createBrowserClient(url, key);
    return client;
}
