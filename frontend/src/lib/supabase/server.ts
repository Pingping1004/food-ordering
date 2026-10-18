import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Server-side client for route handlers (e.g. the e-mail-link callback). */
export async function createSupabaseServer() {
    const cookieStore = await cookies();

    return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        cookies: {
            getAll: () => cookieStore.getAll(),
            setAll: (list) => {
                try {
                    list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
                } catch {
                    /* called from a Server Component – the middleware refreshes cookies instead */
                }
            },
        },
    });
}
