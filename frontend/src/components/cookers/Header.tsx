"use client";

import React from "react";
import { usePathname } from "next/navigation"; // Import usePathname
import { Button } from "../Button";

export default function CookerHeader() {
  const pathname = usePathname();

  return (
    <>
      <header className="w-full flex items-center">
        <div className="grid grid-cols-2 w-full">
          <div className="flex items-center">
            <h1 className="noto-sans-bold text-xl">สมชายซูชิ</h1>
          </div>

          <div className="w-full flex justify-end items-center gap-x-6">
            {/* Conditional rendering based on the current URL */}
            {pathname === "/" && (
              <Button variant="primary" size="md">
                จัดการเมนู
              </Button>
            )}
            {pathname === "/issued-orders" && (
              <Button variant="secondary" size="md">
                กลับ
              </Button>
            )}

            <div>
              <div className="profile-icon">profile</div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
