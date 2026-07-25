import { useEffect, useRef, useState } from "react";

type CountdownTimerProps = {
    deadline: Date;
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
    const hasExpiredRef = useRef(false);
    const onExpireRef = useRef(onExpire);

    useEffect(() => {
        onExpireRef.current = onExpire;
    }, [onExpire]);

    const deadlineMsRef = useRef(deadline.getTime());

    useEffect(() => {
        if (deadlineMsRef.current !== deadline.getTime()) {
            deadlineMsRef.current = deadline.getTime();
            hasExpiredRef.current = false;
        }
        setTimeLeft(getSecondsLeft(deadline));

        const fireExpireOnce = () => {
            if (hasExpiredRef.current) return;
            hasExpiredRef.current = true;
            onExpireRef.current?.();
        };

        const tick = () => {
            const remaining = getSecondsLeft(deadline);
            setTimeLeft(remaining);

            if (remaining <= 0) {
                fireExpireOnce();
            }
        };

        tick();
        const interval = setInterval(tick, 1000);

        return () => clearInterval(interval);
    }, [deadline]);

    return (
        <div className="text-center text-xl font-semibold text-red-500">
            กรุณาชำระเงินภายใน: {formatTime(timeLeft)}
        </div>
    )
}
