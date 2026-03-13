import { useEffect, useState } from "react";

type CountdownTimerProps = {
    duration: number; // seconds
    onExpire?: () => void;
}

export default function CountdownTimer({ duration, onExpire }: CountdownTimerProps) {
    const [timeLeft, setTimieLeft] = useState(duration);

    useEffect(() => {
        if (timeLeft <= 0) {
            onExpire?.();
            return
        }

        const interval = setInterval(() => {
            setTimieLeft((prev) => prev - 1);
        }, 1000);

        return () => clearInterval(interval)
    }, [timeLeft, onExpire]);

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    return (
        <div className="text-center font-semibold text-red-500">
            กรุณาชำระเงินและยืนยันออเดอร์ภายใน:  {minutes}:{seconds.toString().padStart(2, "0")}
        </div>
    )
}