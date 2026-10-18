import { AuthGuard } from "@/auth/auth.guard";

/** Everything under /onboarding needs a session (middleware also redirects anonymous visitors to /login). */
export default function OnboardingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return <AuthGuard>{children}</AuthGuard>;
}
