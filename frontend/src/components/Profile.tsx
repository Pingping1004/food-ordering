import React from "react";
import Image from "next/image";

export default function Profile({ profileSrc }: { readonly profileSrc?: string }) {
    const imageSrc = profileSrc || "/profile.svg";

    return (
        <div
            className="flex w-10 h-10 items-center justify-center"
        >
            <Image
                width={36}
                height={36}
                src={imageSrc}
                alt="Profile Icon"
            />
        </div>
    );
}
