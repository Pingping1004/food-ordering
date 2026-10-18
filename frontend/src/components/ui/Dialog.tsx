"use client";

import { useEffect, useId, useRef } from "react";

/** Minimal accessible modal: Esc / backdrop closes, focus moves inside, labelled by its title. */
export function Dialog({ open, onClose, title, children, wide }: Readonly<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }>) {
    const titleId = useId();
    const panel = useRef<HTMLDivElement>(null);

    // keep the latest onClose without re-running the effect (which would steal focus on every parent render)
    const closeRef = useRef(onClose);
    useEffect(() => { closeRef.current = onClose; });

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
        window.addEventListener("keydown", onKey);
        panel.current?.querySelector<HTMLElement>("textarea, input, button, [tabindex]")?.focus();
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
            <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`relative z-[10000] flex max-h-[90dvh] w-full ${wide ? "max-w-2xl" : "max-w-md"} flex-col gap-4 overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6 font-app text-brand-dark shadow-xl sm:rounded-3xl`}>
                <div className="flex items-start justify-between gap-3">
                    <h2 id={titleId} className="text-xl font-bold">{title}</h2>
                    <button type="button" onClick={onClose} aria-label="ปิด" className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl text-brand-muted hover:bg-ground">✕</button>
                </div>
                {children}
            </div>
        </div>
    );
}
