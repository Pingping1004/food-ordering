import { useEffect, useRef, useState } from "react";

type CountdownTimerProps = {
    deadline: Date;
    onExpire?: () => void;
}

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

    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;

    return (
        <span
            role="timer"
            aria-label={`เหลือเวลาชำระ ${mins} นาที ${secs} วินาที`}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-orange-light px-3 py-2 text-base font-bold text-brand-orange-text"
        >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></svg>
            {mins.toString().padStart(2, "0")}:{secs.toString().padStart(2, "0")}
        </span>
    )
}
