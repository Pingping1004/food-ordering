import { useEffect, useRef, useCallback } from "react";

export function useOrderSounds() {
    const newOrderSoundRef = useRef<HTMLAudioElement | null>(null);
    const paymentSoundRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        newOrderSoundRef.current = new Audio('/sounds/new-order.mp3');
        newOrderSoundRef.current.volume = 0.8;

        paymentSoundRef.current = new Audio('/sounds/payment-confirmed.mp3');
        paymentSoundRef.current.volume = 0.8;

        const unlock = () => {
            newOrderSoundRef.current?.play().then(() => {
                newOrderSoundRef.current!.pause();
                newOrderSoundRef.current!.currentTime = 0;
            }).catch(() => {});
            window.removeEventListener('click', unlock);
        };

        window.addEventListener('click', unlock);
        return () => window.removeEventListener('click', unlock);
    }, []);

    const playNewOrderSound = useCallback(() => {
        if (!newOrderSoundRef.current) return;
        newOrderSoundRef.current.currentTime = 0;
        newOrderSoundRef.current.play().catch(() => {});
    }, []);

    const playPaymentSound = useCallback(() => {
        if (!paymentSoundRef.current) return;
        paymentSoundRef.current.currentTime = 0;
        paymentSoundRef.current.play().catch(() => {});
    }, []);

    return { playNewOrderSound, playPaymentSound };
}