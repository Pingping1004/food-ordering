import { useEffect, useState } from "react";

type CountdownTimerProps = {
    deadline: Date; // seconds
    onExpire?: () => void;
}

const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
};

const getSecondsLeft = (deadline: Date) => Math.max(0, Math.floor((deadline.getTime() - Date.now()) / 1000));

export default function CountdownTimer({ deadline, onExpire }: CountdownTimerProps) {
    const [timeLeft, setTimeLeft] = useState(() => getSecondsLeft(deadline));

    useEffect(() => {
        if (timeLeft <= 0) {
            onExpire?.();
            return
        }

        const interval = setInterval(() => {
            const remaining = getSecondsLeft(deadline);
            setTimeLeft(remaining);

            if (remaining <= 0) {
                clearInterval(interval)
                onExpire?.();
            }
        }, 1000);

        return () => clearInterval(interval)
    }, [deadline, onExpire, timeLeft]);

    return (
        <div className="text-center text-xl font-semibold text-red-500">
            กรุณาชำระเงินภายใน: {formatTime(timeLeft)}
        </div>
    )
}