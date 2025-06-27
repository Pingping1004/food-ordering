"use client";

import React from "react";
import { usePathname } from "next/navigation"; // Import usePathname
import { useRouter } from "next/navigation";
import { Button } from "../Button";
import Profile from "../Profile";

export interface Restaurant {
  name: string;
  email: string;
  location?: string;
  openTime: string;
  closeTime: string;
}

export default function CookerHeader({
  name,
}: Restaurant) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      <header className="w-full flex items-center">
        <div className="flex items-center w-full">
          <h1 className="w-2/5 noto-sans-bold md:text-2xl text-xl inline-block">{name}</h1>

          <div className="w-full flex justify-end items-center gap-x-6">
            {/* Conditional rendering based on the current URL */}
            {pathname === "/" && (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => router.push("/managed-menu")}
              >
                จัดการเมนู
              </Button>
            )}
            {pathname !== "/" && (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => router.push("/")}
              >
                <p className="text-sm">กลับหน้าหลัก</p>
              </Button>
            )}

            <div>
              <div className="profile-icon">
                <Profile />
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
