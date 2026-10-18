import Link from "next/link";

const STEPS = ["ตรวจออเดอร์", "ชำระเงิน", "รอรับอาหาร"];

export function Stepper({ current }: Readonly<{ current: 1 | 2 | 3 }>) {
    return (
        <ol aria-label="ขั้นตอนการสั่ง" className="grid grid-cols-3 gap-2 px-5 pt-4">
            {STEPS.map((label, i) => {
                const n = i + 1;
                return (
                    <li key={label} className="flex flex-col gap-1.5" aria-current={n === current ? "step" : undefined}>
                        <span className={`h-1.5 rounded-full ${n <= current ? "bg-primary-main" : "bg-line"}`} />
                        <span className={`text-[13px] ${n === current ? "font-bold text-primary-dark" : "text-brand-muted"}`}>{n} {label}</span>
                    </li>
                );
            })}
        </ol>
    );
}

export function StepHeader({ title, backHref, backLabel = "กลับ", right }: Readonly<{ title: string; backHref?: string; backLabel?: string; right?: React.ReactNode }>) {
    return (
        <header className="flex items-center justify-between border-b border-line-soft bg-white px-4 py-3">
            <div className="flex items-center gap-2">
                {backHref && (
                    <Link href={backHref} aria-label={backLabel} className="flex h-11 w-11 items-center justify-center rounded-xl text-brand-dark hover:bg-ground">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                    </Link>
                )}
                <h1 className="font-app text-xl font-bold">{title}</h1>
            </div>
            {right}
        </header>
    );
}
