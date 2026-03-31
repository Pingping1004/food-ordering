import { NextRequest, NextResponse } from "next/server"
import type { UserRole } from "./auth/auth.types"

function base64UrlDecode(str: string) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = str.length % 4;
  if (pad) str += "=".repeat(4 - pad);

  return atob(str);
}

function getRole(token?: string): UserRole | null {
  if (!token) return null

  try {
    const payload = JSON.parse(base64UrlDecode(token.split(".")[1]))

    return payload.role
  } catch {
    return null
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const token = req.cookies.get("access_token")?.value;
  const role = getRole(token)

  // cooker
  if (pathname.startsWith("/cooker")) {
    if (!token) return NextResponse.redirect(new URL("/login", req.url))

    if (role !== "cooker") return NextResponse.redirect(new URL("/user", req.url))
  }

  // admin
  if (pathname.startsWith("/admin")) {
    if (!token) return NextResponse.redirect(new URL("/login", req.url))

    if (role !== "admin") return NextResponse.redirect(new URL("/user", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/cooker/:path*", "/admin/:path*"],
}