"use client";

import React from 'react'
import Image from 'next/image';

interface RestaurantHeaderType {
  restaurantId: string;
  name: string;
  restaurantImg: string;
  openTime: string;
  closeTime: string;
}

export default function RestaurantHeader({ name, restaurantImg, openTime, closeTime }: Readonly<RestaurantHeaderType>) {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
    const src = restaurantImg ? `${baseURL}/${restaurantImg}` : `/picture.svg`;

    return (
        <div className="flex w-full gap-x-4 px-6 py-4 border-1 border-color rounded-lg">
            <Image
                src={src}
                width={74}
                height={74}
                alt="restaurant profile"
                priority={true}
                // className="w-auto h-auto"
            />
            <div className="flex flex-col gap-y-2">
                <h3 className="noto-sans-bold text-lg text-primary">{name}</h3>
                <p className="noto-sans-bold text-xs text-secondary">เวลาเปิดขาย: {openTime} - {closeTime}</p>
            </div>
        </div>
    )
}
