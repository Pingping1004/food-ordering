import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Landing point of every Supabase e-mail link (confirm sign-up, reset password), turned into a session cookie.
 * `?token_hash=&type=` (from the e-mail templates) works in any browser, e.g. Gmail's in-app one;
 * `?code=` (PKCE, default templates) only works in the browser that asked for the e-mail.
 */
export async function GET(req: NextRequest) {
    const { searchParams, origin } = new URL(req.url);
    const code = searchParams.get("code");
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type") as EmailOtpType | null;
    const next = searchParams.get("next") ?? "/";
    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

    if (tokenHash && type) {
        const supabase = await createSupabaseServer();
        const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
        if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
    } else if (code) {
        const supabase = await createSupabaseServer();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
    }

    // Used/expired reset links land on the reset page, which explains it and offers a new link.
    if (safeNext === "/reset-password") return NextResponse.redirect(`${origin}/reset-password`);
    return NextResponse.redirect(`${origin}/login?error=link_expired`);
}
