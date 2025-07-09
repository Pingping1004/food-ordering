"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "../Button";
import { useAuth } from "@/context/Authcontext";

export default function UserHeader() {
    const router = useRouter();
    const { user } = useAuth();
    const userId = user?.userId;

    return (
        <header className="flex justify-between items-center">
            <h1 className="noto-sans-bold text-xl">วันนี้กินอะไรดี?</h1>

            {userId ? (
                <div className="flex justify-between gap-x-2">
                    <Button
                        size="md"
                        type="button"
                        variant="tertiary"
                        onClick={() => router.push(`/restaurant-register/${userId}`)}
                    >
                        สมัครร้านอาหาร?
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="secondaryDanger"
                        onClick={() => router.push(`/login`)}
                    >
                        Logout
                    </Button>
                </div>
            ) : (
                <Button
                    type="button"
                    onClick={() => router.push('/signup')}
                >
                    ลงทะเบียน
                </Button>
            )}
        </header >
    );
}
