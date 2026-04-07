import { useEffect, useState } from "react";

type CountdownTimerProps = {
    duration: number; // seconds
    onExpire?: () => void;
}

const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
};

export default function CountdownTimer({ duration, onExpire }: CountdownTimerProps) {
    const [timeLeft, setTimeLeft] = useState(duration);

    useEffect(() => {
        if (timeLeft <= 0) {
            onExpire?.();
            return
        }

        const interval = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);

        return () => clearInterval(interval)
    }, [timeLeft, onExpire]);

    return (
        <div className="text-center text-xl font-semibold text-red-500">
            กรุณาชำระเงินภายใน: {formatTime(timeLeft)}
        </div>
    )
}