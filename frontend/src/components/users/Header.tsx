"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "../Button";
import Profile from "../Profile";
import { useAuth } from "@/context/Authcontext";

export default function UserHeader() {
    const router = useRouter();
    const {user, logout} = useAuth();
    console.log('User from auth context: ', user);
    const userId = user?.userId;

    return (
        <>
            <header className="flex justify-between items-center">
                <h1 className="noto-sans-bold text-2xl">เลือกร้านอาหาร</h1>

                {/* Conditinal rendering isAuth ? signup button : profile icon -> CRUD menu&restaurant profile */}
                {userId ? (
                    <div>hello world</div>
                ): (
                                    <Button
                    type="button"
                    onClick={() => router.push('/signup')}
                >
                    สมัครเป็นร้านอาหาร ?
                </Button>
                )}
            </header>
        </>
    );
}
