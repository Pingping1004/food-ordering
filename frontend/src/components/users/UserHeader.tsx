"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/auth/auth.hooks";
import { Icon } from "@/components/ui/kit";
import { readSelection, type StudentSelection } from "@/lib/services/student";

const greeting = () => {
    const h = new Date().getHours();
    return h < 11 ? "สวัสดีตอนเช้า" : h < 13 ? "สวัสดีตอนเที่ยง" : h < 17 ? "สวัสดีตอนบ่าย" : "สวัสดีตอนเย็น";
};

/**
 * Student home header (design: "เลือกร้าน"): canteen chip → school picker, avatar → account, search slot below.
 * Role switching / "become a restaurant" moved to the account page so this stays a one-purpose screen.
 */
export default function UserHeader({ children }: Readonly<{ children?: React.ReactNode }>) {
    const { user } = useAuth();
    const [sel, setSel] = useState<StudentSelection | null>(null);
    const [hello, setHello] = useState("สวัสดี");

    useEffect(() => {
        setSel(readSelection());
        setHello(greeting());
    }, []);

    const initial = (user?.name ?? user?.email ?? "").trim().charAt(0).toUpperCase();

    return (
        <header className="flex flex-col gap-4 rounded-b-[28px] bg-primary-main px-5 pb-6 pt-5 text-white">
            <div className="flex items-center justify-between gap-3">
                <Link
                    href="/user/onboarding/school?from=account"
                    className="inline-flex h-11 min-w-0 items-center gap-2 rounded-full bg-white/20 px-3.5 text-sm font-semibold hover:bg-white/30"
                >
                    <Icon name="pin" size={18} />
                    <span className="truncate">{sel?.canteenName ?? "เลือกโรงอาหาร"}</span>
                    <Icon name="chevronDown" size={16} />
                </Link>

                {user ? (
                    <Link href="/user/account" aria-label="บัญชีของฉัน" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-base font-bold text-primary-dark">
                        {initial || <Icon name="user" size={20} />}
                    </Link>
                ) : (
                    <Link href="/login" className="flex h-11 shrink-0 items-center rounded-full bg-white px-4 text-sm font-bold text-primary-dark">เข้าสู่ระบบ</Link>
                )}
            </div>

            <div className="flex flex-col gap-1">
                <span className="text-[15px] opacity-90">{hello}</span>
                <h1 className="font-app text-[28px] font-bold leading-tight">วันนี้กินอะไรดี?</h1>
            </div>
            {children}
        </header>
    );
}
