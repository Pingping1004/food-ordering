"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "../Button";
import { useAuth } from "@/context/Authcontext";

export default function UserHeader() {
    const router = useRouter();
    const { user, logout } = useAuth();

    const userId = user?.userId;
    const restaurantId = user?.restaurant?.restaurantId;
    const isApprovedRestaurant = user?.restaurant?.isApproved;
    let routing: string;

    if (userId && !restaurantId) {
        routing = `/restaurant-register/${userId}`;
    } else if (userId && restaurantId && !isApprovedRestaurant) {
        routing = `restaurant/waiting-approved`;
    }

    return (
        <header className="flex justify-between items-center">
            <h1 className="noto-sans-bold text-xl">วันนี้กินอะไรดี?</h1>

            {userId ? (
                <div className="flex justify-between gap-x-2">
                    <Button
                        size="md"
                        type="button"
                        variant="tertiary"
                        onClick={() => {
                            if (isApprovedRestaurant) {
                                router.push(routing);
                            } else {
                                alert('ตอนนี้ทางแอดมินกำลังดำเนินพิจารณาการอนุมัติเปิดร้านอาหาร');
                            }
                        }}
                    >
                        สมัครร้านอาหาร?
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="secondaryDanger"
                        onClick={() => logout()}
                    >
                        ล็อกเอาท์
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
