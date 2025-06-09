"use client";

import clsx from "clsx";
import { VariantProps, cva } from "class-variance-authority";
import React, { useState } from "react";
import { Button } from "../Button";
import Image from "next/image";
import { Toggle } from "../Toggle";

const menuVariants = cva("", {
  variants: {
    variant: {
      default: "",
      managing: "",
    },
    isAvailable: {
      true: "",
      false: "",
    },
  },
  defaultVariants: {
    variant: "default",
    isAvailable: true,
  },
});

type MenuProps = React.HtmlHTMLAttributes<HTMLDivElement> &
  VariantProps<typeof menuVariants> & {
    menuId: string;
    name: string;
    menuImg?: string;
    restaurantName: string;
    maxDaily: number;
    cookingTime: number;
    createdAt: Date | string | number;
    price: number;
    isAvailable: boolean;
  };

export const Menu = ({
  className,
  menuId,
  name,
  menuImg,
  restaurantName,
  maxDaily,
  cookingTime,
  createdAt = new Date(),
  price,
  isAvailable = true,
  children,
  variant = "default",
  ...props
}: MenuProps) => {

  const [isMenuAvailable, setIsMenuAvailable] = useState(isAvailable);
  const handleToggle = (isAvailable: boolean): boolean => {
    const updatedAvailable = !isAvailable;
    setIsMenuAvailable(updatedAvailable);
    console.log(
      "Current available:",
      isAvailable,
      "Updated available:",
      updatedAvailable
    );
    return updatedAvailable;
  };

  const isBlob = menuImg?.startsWith("blob:");
  const src = menuImg ?? "/picture.svg";

  return (
    <div
      className={clsx(
        "flex flex-col p-4 border-1 border-[#E1E1E1] rounded-2xl gap-y-6",
        menuVariants({ variant, isAvailable }),
        className
      )}
      {...props}
    >
      <header className="flex items-center gap-x-6">
        {isBlob ? (
          /* blob URLs work fine in a normal <img> */
          <img src={src} alt={name} className="h-24 w-24 object-cover" />
        ) : (
          /* static or remote image → still use next/image */
          <Image src={src} alt={name} width={96} height={96} />
        )}
        <div className="flex flex-col gap-y-2">
          <div className="flex items-center gap-x-1">
            <h3 className="noto-sans-bold text-md text-primary">{name}</h3>
            <p className="text-sm text-light">(price)</p>
          </div>

          <div>
            <p className="text-secondary text-xs">
              เวลาในการปรุง: {cookingTime}
            </p>
            <p className="text-secondary text-xs">
              จำนวนมากสุดต่อจาน: {maxDaily}
            </p>
          </div>
        </div>
      </header>

      <footer className="flex gap-x-6 justify-between">
        <Button size="md" className="flex w-full" type="button">
          แก้ไขเมนู
        </Button>

        <Button
          variant="secondaryDanger"
          size="md"
          className="flex w-full"
          type="button"
        >
          ลบเมนู
        </Button>
        <Toggle label="เปิดขาย" onClick={() => handleToggle(isMenuAvailable)} />
      </footer>
    </div>
  );
};
