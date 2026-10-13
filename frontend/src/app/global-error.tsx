"use client";

import { Button } from "@/components/Button";
import { captureException } from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
    useEffect(() => {
        captureException(error);
    }, [error]);

    return (
        <div  className="flex flex-col justify-center items-center">
            <h2>เกิดข้อผิดพลาด</h2>
            <NextError statusCode={0} />
            <Button type="button">กลับหน้าหลีก</Button>
        </div>
    );
}