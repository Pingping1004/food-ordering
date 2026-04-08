import { NextRequest, NextResponse } from "next/server"
import type { UserRole } from "./auth/auth.types"

function getRoleFromToken(token?: string): UserRole | null {
  if (!token) return null

  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString()
    )

    return payload.role
  } catch {
    return null
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const refreshToken = req.cookies.get("refresh_token")?.value;
  const accessToken = req.cookies.get("access_token")?.value;

  const token = accessToken || refreshToken
  const role = getRoleFromToken(token)

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