import type { Metadata } from "next";
import "./globals.css";
import { Noto_Sans_Thai, Poppins } from "next/font/google"
import { AuthProvider } from "@/auth/auth.provider";
import { AppToaster } from "@/components/ui/Toast";
import StorageGuard from "@/components/StorageGuard";

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
    icons: {
        icon: "/favicon.svg",
    },
    description: "Have your meal with no deailing with queue",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {

    return (
        <html lang="en">
            <head></head>
            
            <body className={`${poppins.variable} ${notoThai.variable}`}>
                <AuthProvider>
                    <StorageGuard />
                    {children}
                    <AppToaster />
                </AuthProvider>
            </body>
        </html>
    );
}
