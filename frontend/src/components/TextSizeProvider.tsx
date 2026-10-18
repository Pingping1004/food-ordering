"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/** Same key the cooker app already used, so existing preferences carry over (and StorageGuard keeps it). */
export const TEXT_SIZE_KEY = "cook_large_text";

interface TextSizeValue {
    largeText: boolean;
    setLargeText: (value: boolean) => void;
}

const TextSizeContext = createContext<TextSizeValue>({ largeText: false, setLargeText: () => undefined });

const apply = (large: boolean) => {
    if (large) document.documentElement.dataset.textSize = "large";
    else delete document.documentElement.dataset.textSize;
};

/** Inline in <head> so the saved size is applied before first paint (no flash of small text). */
export const TEXT_SIZE_BOOT_SCRIPT = `try{if(JSON.parse(localStorage.getItem("${TEXT_SIZE_KEY}")||"false"))document.documentElement.dataset.textSize="large"}catch(e){}`;

/** App-wide text-size preference. Large mode scales the root font size (see globals.css), so every rem-based size follows. */
export function TextSizeProvider({ children }: Readonly<{ children: React.ReactNode }>) {
    const [largeText, setState] = useState(false);

    useEffect(() => {
        try { setState(JSON.parse(localStorage.getItem(TEXT_SIZE_KEY) ?? "false") === true); } catch { /* storage blocked */ }
    }, []);

    const setLargeText = useCallback((value: boolean) => {
        setState(value);
        apply(value);
        try { localStorage.setItem(TEXT_SIZE_KEY, JSON.stringify(value)); } catch { /* storage blocked: applies for this visit only */ }
    }, []);

    const value = useMemo(() => ({ largeText, setLargeText }), [largeText, setLargeText]);
    return <TextSizeContext.Provider value={value}>{children}</TextSizeContext.Provider>;
}

export const useTextSize = () => useContext(TextSizeContext);
