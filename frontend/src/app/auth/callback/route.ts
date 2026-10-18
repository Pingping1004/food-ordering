import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

/** Landing point of every Supabase e-mail link (confirm sign-up, reset password): swaps `?code=` for a session cookie. */
export async function GET(req: NextRequest) {
    const { searchParams, origin } = new URL(req.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/";
    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

    if (code) {
        const supabase = await createSupabaseServer();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
    }

    return NextResponse.redirect(`${origin}/login?error=link_expired`);
}
