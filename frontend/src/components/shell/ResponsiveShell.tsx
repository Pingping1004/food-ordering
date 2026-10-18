"use client";

import Link from "next/link";
import clsx from "clsx";
import React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/kit";
import { Logo } from "@/components/Logo";

/**
 * One navigation rule for every signed-in area:
 *   below 768px (`md`)  -> sticky top NAVBAR + slide-over drawer
 *   768px and up        -> persistent left SIDEBAR (sticky, full height, scrolls on its own)
 * Content always lives in `<main class="min-w-0 flex-1">`.
 * `--sidebar-w` / `--mobile-nav-h` (globals.css) let fixed bottom bars inside pages line up with the content column.
 */

export type ShellNavItem = {
    key: string;
    label: string;
    href: string;
    icon: IconName;
    active?: boolean;
    badge?: React.ReactNode;
    /** Optional section heading shown above the first item of each group (omit for a flat list). */
    group?: string;
};

export type ShellBrand = {
    href: string;
    ariaLabel: string;
    title: string;
    subtitle?: string;
};

type Tone = "light" | "dark";

type Props = Readonly<{
    brand: ShellBrand;
    navLabel: string;
    items: ShellNavItem[];
    /** Rendered at the bottom of the sidebar and of the drawer (OrderShortcut, role home, account / logout...). Use `ShellFooterLink` / `ShellFooterButton` for rows. */
    footer?: React.ReactNode;
    /** Optional block above the footer rows (e.g. school name card). */
    footerTop?: React.ReactNode;
    /** Optional block directly under the brand, above the nav (e.g. school name card). */
    brandBelow?: React.ReactNode;
    /** Extra controls in the mobile navbar, between the title and the hamburger (e.g. an order icon). */
    mobileActions?: React.ReactNode;
    /** Optional current area label shown in the mobile navbar next to the logo. */
    areaTitle?: string;
    tone?: Tone;
    /** Hide all chrome when printing. */
    noPrint?: boolean;
    /** `div` by default because most pages already render their own `<main>`; pass "main" when the page does not. */
    contentAs?: "main" | "div";
    mainClassName?: string;
    children: React.ReactNode;
}>;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const TONES = {
    light: {
        bar: "bg-white text-brand-dark border-line-soft",
        panel: "bg-white text-brand-dark",
        side: "bg-white text-brand-dark border-line-soft",
        sub: "text-brand-muted",
        item: "text-slate hover:bg-ground",
        itemActive: "bg-primary-light font-bold text-primary-dark",
        icon: "hover:bg-ground",
        badge: "bg-primary-main text-white",
    },
    dark: {
        bar: "bg-brand-dark text-white border-white/10",
        panel: "bg-brand-dark text-white",
        side: "bg-brand-dark text-white border-white/10",
        sub: "text-white/70",
        item: "text-white hover:bg-white/10",
        itemActive: "bg-white font-bold text-brand-dark",
        icon: "hover:bg-white/10",
        badge: "bg-brand-orange text-white",
    },
} as const;

export function ResponsiveShell({ brand, navLabel, items, footer, footerTop, brandBelow, mobileActions, areaTitle, tone = "light", noPrint = true, contentAs: Content = "div", mainClassName, children }: Props) {
    const t = TONES[tone];
    const pathname = usePathname();
    // remember *where* the drawer was opened: navigating anywhere else closes it without an effect
    const [openAt, setOpenAt] = useState<string | null>(null);
    const open = openAt === pathname;
    const close = useCallback(() => setOpenAt(null), []);

    return (
        <div className={clsx("app-shell flex min-h-dvh flex-col bg-ground font-app text-brand-dark md:flex-row")}>
            {/* ───────── < md : top navbar ───────── */}
            <header
                className={clsx("sticky top-0 z-40 flex items-center gap-2 border-b px-3 md:hidden", t.bar, noPrint && "no-print")}
                style={{ paddingTop: "env(safe-area-inset-top)", paddingLeft: "max(0.75rem, env(safe-area-inset-left))", paddingRight: "max(0.75rem, env(safe-area-inset-right))" }}
            >
                <div className="flex justify-between w-full py-2">
                    <button
                    type="button"
                    aria-label="เปิดเมนู"
                    aria-expanded={open}
                    aria-controls="shell-drawer"
                    aria-haspopup="dialog"
                    onClick={() => setOpenAt(pathname)}
                    className={clsx("flex h-11 w-11 items-center justify-center rounded-[10px]", t.icon)}
                >
                    <Icon name="menu" size={24} />
                </button>
                <Link href={brand.href} aria-label={brand.ariaLabel} className="flex min-h-11 min-w-0 items-center gap-2">
                    <Logo size={30} />
                    <span className="truncate text-base font-bold">{areaTitle ?? brand.title}</span>
                </Link>
                <div className="ml-auto flex items-center gap-1.5">
                    {mobileActions}
                </div>
                </div>
            </header>

            {open && <Drawer id="shell-drawer" tone={tone} brand={brand} navLabel={navLabel} items={items} footer={footer} footerTop={footerTop} brandBelow={brandBelow} onClose={close} />}

            {/* ───────── >= md : persistent sidebar ───────── */}
            <aside
                className={clsx("sticky top-0 hidden h-dvh w-[var(--sidebar-w)] shrink-0 flex-col gap-5 overflow-y-auto overscroll-contain border-r px-3 py-5 md:flex", t.side, noPrint && "no-print")}
            >
                <BrandLink brand={brand} subTone={t.sub} />
                {brandBelow}
                <NavList label={navLabel} items={items} t={t} />
                <div className="mt-auto flex flex-col gap-2.5">
                    {footerTop}
                    {footer}
                </div>
            </aside>

            <Content className={clsx("min-w-0 flex-1", mainClassName)}>{children}</Content>
        </div>
    );
}

function BrandLink({ brand, subTone }: Readonly<{ brand: ShellBrand; subTone: string }>) {
    return (
        <Link href={brand.href} aria-label={brand.ariaLabel} className="flex min-h-11 min-w-0 items-center gap-2.5 px-2">
            <Logo size={36} />
            <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-base font-bold">{brand.title}</span>
                {brand.subtitle && <span className={clsx("truncate text-xs", subTone)}>{brand.subtitle}</span>}
            </span>
        </Link>
    );
}

function NavList({ label, items, t }: Readonly<{ label: string; items: ShellNavItem[]; t: (typeof TONES)[Tone] }>) {
    return (
        <nav aria-label={label} className="flex flex-col gap-1">
            {items.map((n, i) => (
                <React.Fragment key={n.key}>
                    {n.group && n.group !== items[i - 1]?.group && (
                        <span className={clsx("px-3 pb-1 text-xs font-semibold tracking-wide", i > 0 && "pt-3", t.sub)}>{n.group}</span>
                    )}
                    <Link
                        href={n.href}
                        aria-current={n.active ? "page" : undefined}
                        onClick={(e) => {
                            if (n.href.includes("#")) {
                                const [targetPath, hash] = n.href.split("#");
                                if (hash && (typeof window !== "undefined" && (window.location.pathname === targetPath || !targetPath))) {
                                    const el = document.getElementById(hash);
                                    if (el) {
                                        e.preventDefault();
                                        el.scrollIntoView({ behavior: "smooth" });
                                    }
                                }
                            }
                        }}
                        className={clsx("flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[15px]", n.active ? t.itemActive : clsx("font-medium", t.item))}
                    >
                        <Icon name={n.icon} />
                        <span className="min-w-0 flex-1 truncate">{n.label}</span>
                        {n.badge != null && <span className={clsx("rounded-full px-2 py-0.5 text-xs font-bold", t.badge)}>{n.badge}</span>}
                    </Link>
                </React.Fragment>
            ))}
        </nav>
    );
}

/** Accessible slide-over: focus is trapped, Escape / overlay / any link closes it, the page behind cannot scroll. */
function Drawer({ id, tone, brand, navLabel, items, footer, footerTop, brandBelow, onClose }: Readonly<{ id: string; tone: Tone; brand: ShellBrand; navLabel: string; items: ShellNavItem[]; footer?: React.ReactNode; footerTop?: React.ReactNode; brandBelow?: React.ReactNode; onClose: () => void }>) {
    const t = TONES[tone];
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const previouslyFocused = document.activeElement as HTMLElement | null;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
        return () => {
            document.body.style.overflow = prevOverflow;
            previouslyFocused?.focus?.();
        };
    }, []);

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
            return;
        }
        if (e.key !== "Tab") return;
        const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (!nodes || nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    };

    return (
        <div className={clsx("fixed inset-0 z-50 md:hidden no-print")} onKeyDown={onKeyDown}>
            <button type="button" aria-label="ปิดเมนู" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default bg-black/45" />
            <div
                ref={panelRef}
                id={id}
                role="dialog"
                aria-modal="true"
                aria-label={navLabel}
                // any link/button inside (navigation, order shortcut, logout) dismisses the drawer
                onClick={(e) => { if ((e.target as HTMLElement).closest("a")) onClose(); }}
                className={clsx("drawer-in absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col gap-4 overflow-y-auto overscroll-contain px-3 shadow-2xl", t.panel)}
                style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "max(1rem, env(safe-area-inset-bottom))", paddingLeft: "max(0.75rem, env(safe-area-inset-left))" }}
            >
                <div className="flex items-center gap-1">
                    <div className="min-w-0 flex-1"><BrandLink brand={brand} subTone={t.sub} /></div>
                    <button type="button" data-autofocus aria-label="ปิดเมนู" onClick={onClose} className={clsx("flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px]", t.icon)}>
                        <Icon name="x" size={24} />
                    </button>
                </div>
                {brandBelow}
                <NavList label={navLabel} items={items} t={t} />
                <div className="mt-auto flex flex-col gap-2.5">
                    {footerTop}
                    {footer}
                </div>
            </div>
        </div>
    );
}

/* ───────── footer rows (same look in sidebar and drawer) ───────── */

const ROW = "flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 text-[15px] font-medium";

export function ShellFooterLink({ href, icon, children, tone = "light" }: Readonly<{ href: string; icon: IconName; children: React.ReactNode; tone?: Tone }>) {
    return (
        <Link href={href} className={clsx(ROW, TONES[tone].item)}>
            <Icon name={icon} />
            {children}
        </Link>
    );
}

export function ShellFooterButton({ onClick, icon, children, tone = "light" }: Readonly<{ onClick: () => void; icon: IconName; children: React.ReactNode; tone?: Tone }>) {
    return (
        <button type="button" onClick={onClick} className={clsx(ROW, "text-left", TONES[tone].item)}>
            <Icon name={icon} />
            {children}
        </button>
    );
}
