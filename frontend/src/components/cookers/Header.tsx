"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation"; // Import usePathname
import { Button } from "../Button";
import Profile from "../Profile";

export interface Restaurant {
  restaurantId: string;
  name: string;
  email: string;
  location?: string;
  openTime: string;
  closeTime: string;
}

export default function CookerHeader({
  name,
  restaurantId,
}: Readonly<Restaurant>) {
  const pathname = usePathname();
  const router = useRouter();

  return (
      <header className="w-full flex items-center">
        <div className="flex items-center w-full">
          <h1 className="w-2/5 noto-sans-bold md:text-2xl text-xl inline-block">{name}</h1>

          <div className="w-full flex justify-end items-center gap-x-6">
            {/* Conditional rendering based on the current URL */}
            {pathname === `/cooker/${restaurantId}` && (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => router.push(`/managed-menu/${restaurantId}`)}
              >
                จัดการเมนู
              </Button>
            )}
            {pathname !== `/cooker/${restaurantId}` && (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => router.push(`/cooker/${restaurantId}`)}
              >
                <p className="text-sm">กลับหน้าหลัก</p>
              </Button>
            )}

            <div>
              <div className="profile-icon">
                {restaurantId ? (
                  <button
                    onClick={() => router.push(`/restaurant/profile/${restaurantId}`)}
                  >
                    <Profile />
                  </button>
                ) : (
                  <Button
                    type="button"
                    variant="secondaryDanger"
                    onClick={() => router.push(`/restaurant/profile/${restaurantId}`)}
                  >
                    Logout
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
  );
}
