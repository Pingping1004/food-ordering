import { createServerClient } from "@supabase/ssr"
import { NextRequest, NextResponse } from "next/server"

/**
 * Edge gate = "is there a Supabase session?" plus cookie refresh. Roles / memberships can't be read from the
 * Supabase token (they live in our DB), so the client guards and – authoritatively – the API enforce those.
 */
const NEEDS_SESSION = ["/cooker", "/school", "/workspace", "/admin", "/user", "/onboarding"]
const OPEN_TO_ANY_SESSION_PATHS = ["/cooker/restaurant-register", "/cooker/pending"]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  let res = NextResponse.next({ request: req })

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value))
        res = NextResponse.next({ request: req })
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
      },
    },
  })

  // getUser() re-validates with Supabase (getSession() alone would trust an unverified cookie)
  const { data: { user } } = await supabase.auth.getUser()

  const gated = NEEDS_SESSION.some((p) => pathname.startsWith(p)) || OPEN_TO_ANY_SESSION_PATHS.some((p) => pathname.startsWith(p))
  if (gated && !user) {
    const url = new URL("/login", req.url)
    url.searchParams.set("next", pathname + req.nextUrl.search)
    return NextResponse.redirect(url)
  }

  return res
}

export const config = {
  matcher: ["/cooker/:path*", "/admin/:path*", "/school/:path*", "/user/:path*", "/onboarding/:path*", "/workspace"],
}
