import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Kanit } from "next/font/google"
import { AuthProvider } from "@/auth/auth.provider";
import { AppToaster } from "@/components/ui/Toast";
import { TextSizeProvider, TEXT_SIZE_BOOT_SCRIPT } from "@/components/TextSizeProvider";
import StorageGuard from "@/components/StorageGuard";
import { ReactQueryProvider } from "@/lib/provider/ReactQueryProvider";
import { INSTALL_PROMPT_BOOT_SCRIPT } from "@/lib/install-app";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/** One family for Thai + Latin: Kanit's Latin glyphs are geometric, so no second font is needed. */
const kanit = Kanit({
    subsets: ["thai", "latin"],
    weight: ["300", "400", "500", "600", "700"],
    variable: "--font-kanit",
    // "optional" never swaps the font in late, which re-wrapped the Thai text and shifted whole pages (CLS 0.2–0.6).
    // Cost: on a cold first visit a slow connection may show the system font for that one page view.
    display: "optional",
});

export const metadata: Metadata = {
    title: "Promptserve",
    manifest: "/manifest.json",
    icons: {
        icon: "/favicon.svg?v=2",
        apple: "/apple-touch-icon.png", // iOS ignores SVG here and would use a screenshot as the home-screen icon
    },
    description: "Have your meal with no deailing with queue",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Promptserve",
    },
};

/** `viewport-fit=cover` lets the shell pad itself with the safe-area insets (notch / home indicator). */
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {

    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <meta name="theme-color" content="#006CFE" />
                <script dangerouslySetInnerHTML={{ __html: TEXT_SIZE_BOOT_SCRIPT }} />
                <script dangerouslySetInnerHTML={{ __html: INSTALL_PROMPT_BOOT_SCRIPT }} />
            </head>

            <body className={kanit.variable}>
                <ReactQueryProvider>
                    <AuthProvider>
                        <TextSizeProvider>
                        <StorageGuard />
                        {children}
                        <AppToaster />
                        </TextSizeProvider>
                    </AuthProvider>
                </ReactQueryProvider>
                {/* Vercel Web Analytics + Speed Insights (real-user Core Web Vitals): cookieless, no user ids; inert
                    outside Vercel deployments. */}
                <Analytics />
                <SpeedInsights />
            </body>
        </html>
    );
}
