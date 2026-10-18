"use client";

import { useTextSize } from "@/components/TextSizeProvider";

/** The "ขนาดตัวอักษร" picker. Changes apply to the whole app immediately. */
export function TextSizeSetting() {
    const { largeText, setLargeText } = useTextSize();
    return (
        <section className="flex flex-col gap-3.5 rounded-[20px] border border-line-soft bg-white p-[18px]">
            <h2 className="text-xl font-bold">ขนาดตัวอักษร</h2>
            <div role="radiogroup" aria-label="ขนาดตัวอักษร" className="grid grid-cols-2 gap-2.5">
                {[{ v: false, label: "ปกติ", size: "text-lg" }, { v: true, label: "ใหญ่", size: "text-2xl" }].map((o) => (
                    <button
                        key={o.label}
                        type="button"
                        role="radio"
                        aria-checked={largeText === o.v}
                        onClick={() => setLargeText(o.v)}
                        className={`flex h-[72px] flex-col items-center justify-center gap-0.5 rounded-2xl ${largeText === o.v ? "border-2 border-primary-main bg-[#F5F8FF] text-primary-dark" : "border-[1.5px] border-line"}`}
                    >
                        <span className={`${o.size} font-bold`}>ก</span>
                        <span className="text-sm font-semibold">{o.label}</span>
                    </button>
                ))}
            </div>
        </section>
    );
}
