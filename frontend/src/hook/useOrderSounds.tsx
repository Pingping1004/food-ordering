import { useEffect, useRef, useCallback } from "react";

export function useOrderSounds() {
    const newOrderSoundRef = useRef<HTMLAudioElement | null>(null);
    const paymentSoundRef = useRef<HTMLAudioElement | null>(null);
    const alertLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopAlertLoop = useCallback(() => {
        if (alertLoopRef.current) {
            clearInterval(alertLoopRef.current);
            alertLoopRef.current = null;
        }
    }, []);

    useEffect(() => {
        newOrderSoundRef.current = new Audio('/sounds/new-order.mp3');
        newOrderSoundRef.current.volume = 0.8;

        paymentSoundRef.current = new Audio('/sounds/payment-confirmed.mp3');
        paymentSoundRef.current.volume = 0.8;

        const unlock = () => {
            const primeAudio = async (audio: HTMLAudioElement | null) => {
                if (!audio) return;

                try {
                    await audio.play();
                    audio.pause();
                    audio.currentTime = 0;
                } catch {
                    // Browser blocked autoplay priming. We'll try again on the next interaction.
                }
            };

            void primeAudio(newOrderSoundRef.current);
            void primeAudio(paymentSoundRef.current);
            window.removeEventListener('click', unlock);
            window.removeEventListener('touchstart', unlock);
        };

        window.addEventListener('click', unlock);
        window.addEventListener('touchstart', unlock, { passive: true });
        return () => {
            stopAlertLoop();
            window.removeEventListener('click', unlock);
            window.removeEventListener('touchstart', unlock);
        };
    }, [stopAlertLoop]);

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

    const playAlertOnce = useCallback(() => {
        stopAlertLoop();
        playNewOrderSound();
    }, [playNewOrderSound, stopAlertLoop]);
    
    return { playNewOrderSound, playPaymentSound, playAlertOnce, stopAlertLoop };
}
