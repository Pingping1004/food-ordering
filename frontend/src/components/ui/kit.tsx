import Link from "next/link";
import clsx from "clsx";
import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, ButtonHTMLAttributes } from "react";
import { TONE_CLASS, type Tone } from "@/lib/schema/format";

/* ───────────────────────── icons (stroke paths from the design) ───────────────────────── */

export const ICONS = {
    home: "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
    orders: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
    back: "m15 18-6-6 6-6",
    chevron: "m9 18 6-6-6-6",
    chevronDown: "m6 9 6 6 6-6",
    check: "M20 6 9 17l-5-5",
    x: "M18 6 6 18M6 6l12 12",
    clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
    alert: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v4M12 16h.01",
    info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16v-4M12 8h.01",
    bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0",
    search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3",
    pin: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    dashboard: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
    chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    store: "M3 9l1-5h16l1 5M4 9v11h16V9M9 20v-6h6v6",
    chat: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
    users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
    file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5",
    settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4",
    menu: "M4 6h16M4 12h16M4 18h10",
    clipboard: "M9 5h6M9 3h6v4H9zM6 5H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1M8 12h8M8 16h5",
    school: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6",
    link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
    arrowUp: "M12 19V5M5 12l7-7 7 7",
    arrowDown: "M12 5v14M19 12l-7 7-7-7",
    calendar: "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 2v4M8 2v4M3 10h18",
    camera: "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3zM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    qr: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3",
    plate: "M3 2v7c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2V2M6 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7",
    bowl: "M3 11h18a9 9 0 0 1-18 0zM7 7c0-2 2-2 2-4M12 7c0-2 2-2 2-4M17 7c0-2 2-2 2-4",
    cup: "M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 2v3M10 2v3M14 2v3",
    chef: "M6 13.9A4 4 0 0 1 8 6.1a5 5 0 0 1 8 0 4 4 0 0 1 2 7.8V21H6zM6 17h12",
    plus: "M12 5v14M5 12h14",
    logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
    refund: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5",
    lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
    print: "M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z",
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, strokeWidth = 2, className }: Readonly<{ name: IconName; size?: number; strokeWidth?: number; className?: string }>) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={clsx("shrink-0", className)}>
            <path d={ICONS[name]} />
        </svg>
    );
}

/* ───────────────────────── surfaces ───────────────────────── */

export function Card({ className, children, as: Tag = "section", ...rest }: Readonly<{ className?: string; children: ReactNode; as?: "section" | "div" | "article" | "li" } & React.HTMLAttributes<HTMLElement>>) {
    return (
        <Tag className={clsx("rounded-[18px] border border-line-soft bg-white", className)} {...(rest as object)}>
            {children}
        </Tag>
    );
}

/** Status pill – always icon + text so meaning never depends on colour alone. */
export function Chip({ tone = "neutral", icon, children, className }: Readonly<{ tone?: Tone; icon?: IconName; children: ReactNode; className?: string }>) {
    return (
        <span className={clsx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-bold", TONE_CLASS[tone], className)}>
            {icon && <Icon name={icon} size={14} strokeWidth={2.4} />}
            {children}
        </span>
    );
}

export function Notice({ tone = "primary", icon = "info", children, role = "note", className }: Readonly<{ tone?: Tone; icon?: IconName; children: ReactNode; role?: "note" | "status" | "alert"; className?: string }>) {
    return (
        <div role={role} className={clsx("flex gap-3 rounded-2xl px-4 py-3.5 text-[15px] leading-normal text-brand-dark", TONE_CLASS[tone].split(" ")[0], className)}>
            <Icon name={icon} size={22} className={clsx("mt-px", TONE_CLASS[tone].split(" ")[1])} />
            <div className="min-w-0">{children}</div>
        </div>
    );
}

export function EmptyState({ title, body, action }: Readonly<{ title: string; body?: string; action?: ReactNode }>) {
    return (
        <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <p className="text-lg font-bold">{title}</p>
            {body && <p className="max-w-sm text-base text-brand-muted">{body}</p>}
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}

export {
    Skeleton,
    SkeletonText,
    RestaurantCardSkeleton,
    RestaurantListSkeleton,
    MenuCardSkeleton,
    MenuListSkeleton,
    RestaurantDetailSkeleton,
    OrderCardSkeleton,
    OrderListSkeleton,
    OrderTrackingSkeleton,
    CookerBoardSkeleton,
    CookerSummarySkeleton,
    SchoolOverviewSkeleton,
    TableSkeleton,
    CardListSkeleton,
    FormSkeleton,
    PageSkeleton,
} from "./Skeleton";

export { Logo } from "@/components/Logo";

export function ErrorState({ message = "โหลดข้อมูลไม่สำเร็จ", onRetry }: Readonly<{ message?: string; onRetry?: () => void }>) {
    return (
        <div role="alert" className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <Icon name="alert" size={32} className="text-danger-main" />
            <p className="text-base font-semibold">{message}</p>
            {onRetry && <button type="button" onClick={onRetry} className="h-12 rounded-xl border-[1.5px] border-line bg-white px-5 text-base font-semibold">ลองใหม่</button>}
        </div>
    );
}

/* ───────────────────────── buttons ───────────────────────── */

type Variant = "primary" | "outline" | "danger" | "ghost" | "dangerOutline";
type Size = "md" | "lg" | "xl";

const VARIANT: Record<Variant, string> = {
    primary: "bg-primary-main text-white hover:bg-primary-dark",
    outline: "border-[1.5px] border-line bg-white text-brand-dark hover:bg-ground",
    danger: "bg-danger-main text-white",
    dangerOutline: "border-[1.5px] border-danger-main bg-white text-danger-text",
    ghost: "bg-transparent text-primary-dark hover:bg-primary-light",
};
const SIZE: Record<Size, string> = {
    md: "h-11 rounded-[10px] px-4 text-[15px] font-semibold",
    lg: "h-14 rounded-2xl px-6 text-[17px] font-bold",
    xl: "h-[68px] rounded-[18px] px-6 text-[22px] font-bold", // cooker: 64px+ touch targets
};
const btn = (variant: Variant, size: Size, full?: boolean, className?: string) =>
    clsx("inline-flex items-center justify-center gap-2 font-app transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-main disabled:pointer-events-none disabled:opacity-50", VARIANT[variant], SIZE[size], full && "w-full", className);

export function ButtonLink({ href, variant = "primary", size = "lg", full, className, children }: Readonly<{ href: string; variant?: Variant; size?: Size; full?: boolean; className?: string; children: ReactNode }>) {
    return <Link href={href} className={btn(variant, size, full, className)}>{children}</Link>;
}

export function ActionButton({ variant = "primary", size = "lg", full, className, children, type = "button", ...rest }: Readonly<{ variant?: Variant; size?: Size; full?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>>) {
    return <button type={type} className={btn(variant, size, full, className)} {...rest}>{children}</button>;
}

/* ───────────────────────── form fields ───────────────────────── */

const FIELD =
    "w-full border-[1.5px] border-line bg-white font-app text-brand-dark outline-none placeholder:text-brand-muted/70 focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 aria-[invalid=true]:border-2 aria-[invalid=true]:border-danger-main";
const FIELD_SIZE = { md: "h-[46px] rounded-[10px] px-3 text-[15px]", lg: "h-[54px] rounded-[14px] px-4 text-[17px]", xl: "h-[60px] rounded-2xl border-2 px-[18px] text-xl" } as const;

type FieldSize = keyof typeof FIELD_SIZE;

export function Field({ label, hint, error, size = "md", children }: Readonly<{ label: string; hint?: string; error?: string; size?: FieldSize; children: ReactNode }>) {
    const labelSize = size === "xl" ? "text-[19px] font-bold gap-2.5" : size === "lg" ? "text-[15px] font-semibold gap-2" : "text-sm font-semibold gap-1.5";
    return (
        <label className={clsx("flex flex-col", labelSize)}>
            {label}
            {children}
            {hint && !error && <span className={clsx("font-normal text-brand-muted", size === "xl" ? "text-base" : "text-[13px]")}>{hint}</span>}
            {error && (
                <span role="alert" className="flex items-center gap-1.5 text-sm font-medium text-danger-text">
                    <Icon name="alert" size={16} strokeWidth={2.2} />
                    {error}
                </span>
            )}
        </label>
    );
}

export function TextInput({ size = "md", className, invalid, ...rest }: Readonly<{ size?: FieldSize; invalid?: boolean } & Omit<InputHTMLAttributes<HTMLInputElement>, "size">>) {
    return <input aria-invalid={invalid || undefined} className={clsx(FIELD, FIELD_SIZE[size], "font-normal", className)} {...rest} />;
}

export function SelectInput({ size = "md", className, children, ...rest }: Readonly<{ size?: FieldSize } & Omit<SelectHTMLAttributes<HTMLSelectElement>, "size">>) {
    return <select className={clsx(FIELD, FIELD_SIZE[size], "font-normal", className)} {...rest}>{children}</select>;
}

export function SearchInput({ label, className, ...rest }: Readonly<{ label: string } & InputHTMLAttributes<HTMLInputElement>>) {
    return (
        <label className={clsx("flex h-[52px] items-center gap-2.5 rounded-[14px] border-[1.5px] border-line bg-white px-4 text-brand-muted", className)}>
            <Icon name="search" />
            <span className="sr-only">{label}</span>
            <input type="search" className="min-w-0 flex-1 bg-transparent font-app text-base text-brand-dark outline-none" {...rest} />
        </label>
    );
}

/** Selected = icon + border + colour (never colour alone). */
export function ChoiceButton({ selected, onClick, children, role = "radio", className, disabled }: Readonly<{ selected: boolean; onClick: () => void; children: ReactNode; role?: "radio" | "checkbox"; className?: string; disabled?: boolean }>) {
    return (
        <button
            type="button"
            role={role}
            aria-checked={selected}
            disabled={disabled}
            onClick={onClick}
            className={clsx(
                "flex min-h-[60px] items-center justify-center gap-2 rounded-2xl p-3 text-center font-app transition-colors disabled:opacity-50",
                selected ? "border-2 border-primary-main bg-ground-blue text-primary-dark" : "border-[1.5px] border-line bg-white text-brand-dark hover:bg-ground",
                className,
            )}
        >
            {children}
        </button>
    );
}

export function SwitchRow({ checked, onChange, label, sub, disabled }: Readonly<{ checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string; disabled?: boolean }>) {
    return (
        <div className="flex min-h-[68px] items-center gap-3 border-b border-row-line py-2 last:border-b-0">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-base font-semibold">{label}</span>
                {sub && <span className="text-sm text-brand-muted">{sub}</span>}
            </span>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                disabled={disabled}
                onClick={() => onChange(!checked)}
                className={clsx("flex h-8 w-14 shrink-0 items-center rounded-full px-[3px] py-0 transition-colors disabled:opacity-50", checked ? "bg-success-main" : "bg-[#98A2B3]")}
            >
                {/* items-center keeps the knob vertically centred whatever padding/line-height the button inherits */}
                <span className={clsx("block h-[26px] w-[26px] shrink-0 rounded-full bg-white shadow-sm transition-transform", checked && "translate-x-6")} />
            </button>
        </div>
    );
}

/* ───────────────────────── layout bits ───────────────────────── */

export function SectionHeading({ children, aside }: Readonly<{ children: ReactNode; aside?: ReactNode }>) {
    return (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">{children}</h2>
            {aside && <span className="text-[13px] text-brand-muted">{aside}</span>}
        </div>
    );
}

/** Wide tables scroll inside their own box instead of breaking the page at phone width. */
export function TableWrap({ children, minWidth = 520 }: Readonly<{ children: ReactNode; minWidth?: number }>) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[15px]" style={{ minWidth }}>{children}</table>
        </div>
    );
}
export const TH = "border-b border-line-soft px-2 py-2.5 text-left text-[13px] font-semibold text-brand-muted";
export const TD = "border-b border-row-line px-2 py-3";

export function Segmented<T extends string>({ value, onChange, options, label }: Readonly<{ value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }>) {
    return (
        <div role="tablist" aria-label={label} className="grid gap-1.5 rounded-xl bg-neutral-light p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    role="tab"
                    aria-selected={o.value === value}
                    onClick={() => onChange(o.value)}
                    className={clsx("h-10 rounded-[9px] px-2 font-app text-[15px]", o.value === value ? "bg-white font-bold shadow-sm" : "font-semibold text-neutral-text")}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}
