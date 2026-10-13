import type { Metadata } from "next";
import "./globals.css";
import { Noto_Sans_Thai, Poppins } from "next/font/google"
import { AuthProvider } from "@/auth/auth.provider";
import { AppToaster } from "@/components/ui/Toast";
import StorageGuard from "@/components/StorageGuard";
import { ReactQueryProvider } from "@/lib/provider/ReactQueryProvider";

const notoThai = Noto_Sans_Thai({
    subsets: ["thai"],
    weight: ["400", "700"],
    variable: "--font-noto-thai",
    display: "swap"
});

const poppins = Poppins({
    subsets: ["latin"],
    weight: ["400", "600", "700"],
    variable: "--font-poppins",
    display: "swap",
});

export const metadata: Metadata = {
    title: "Promptserve",
    manifest: "/manifest.json",
    icons: {
        icon: "/favicon.svg?v=2",
        apple: "/favicon.svg?v=2",
    },
    description: "Have your meal with no deailing with queue",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Promptserve",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {

    return (
        <html lang="en">
            <head>
                <meta name="theme-color" content="#006CFE" />
            </head>

            <body className={`${poppins.variable} ${notoThai.variable}`}>
                <ReactQueryProvider>
                    <AuthProvider>
                        <StorageGuard />
                        {children}
                        <AppToaster />
                    </AuthProvider>
                </ReactQueryProvider>
            </body>
        </html>
    );
}
