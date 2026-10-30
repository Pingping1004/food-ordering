"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import UserHeader from "@/components/users/UserHeader";
import RestaurantProfile from "@/components/users/RestaurantProfile";
import { StudentShell } from "@/components/users/StudentShell";
import { ErrorState, Icon, Notice, RestaurantListSkeleton, SearchInput } from "@/components/ui/kit";
import { Button } from "@/components/Button";
import { api } from "@/lib/api";
import type { Restaurant } from "@/app/data/type";
import { buttonLabels } from "@/common/restaurant.enum";
import { getDayStatus, readSelection } from "@/lib/services/student";
import { routeForOrder, screenForOrder } from "@/lib/order-flow";
import { useStudentOrder } from "@/hook/useStudentOrder";
import { ORDER_STATUS, orderCode } from "@/lib/schema/format";
import { normalizeStatus, fmtTime, pickupAtOf } from "@/lib/order-flow";

const Modal = dynamic(() => import("../../../components/users/Modal"), { ssr: false });

const CUTOFF_LABEL = "10:30"; // TODO(school-settings): read from the canteen's order cut-off once the schema has one

const fetchRestaurants = async (limit: number): Promise<Restaurant[]> => (await api.get("/restaurant", { params: { limit } })).data;

/** The order this browser is currently following (set at checkout) – shown as a pinned card above the shop list. */
function ActiveOrderCard() {
    const [id, setId] = useState<string | null>(null);
    useEffect(() => { try { setId(localStorage.getItem("activeOrderId")); } catch { setId(null); } }, []);

    const { data } = useStudentOrder(id, { poll: true, minPollMs: 20_000 });

    if (!id || !data) return null;
    const screen = screenForOrder(data);
    if (screen === "failed") return null;
    const status = normalizeStatus(data.status);
    const label = screen === "payment" ? "รอชำระเงิน" : ORDER_STATUS[status].label;

    return (
        <Link href={routeForOrder(id, data)} className="flex items-center gap-3.5 rounded-[18px] border-[1.5px] border-primary-main bg-white p-4 text-brand-dark">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-primary-light text-primary-dark"><Icon name="clock" size={24} /></span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-base font-bold">ออเดอร์ {orderCode(id)} · {label}</span>
                <span className="truncate text-sm text-brand-muted">{data.restaurant?.name} · {screen === "payment" ? "แตะเพื่อชำระเงิน" : `พร้อมรับประมาณ ${fmtTime(pickupAtOf(data))}`}</span>
            </span>
            <Icon name="chevron" className="text-primary-dark" />
        </Link>
    );
}

export default function UserHomePage() {
    const router = useRouter();
    const [showModal, setShowModal] = useState(false);
    const [visibleCount, setVisibleCount] = useState(12);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState<string>("all");

    const { data: restaurants = [], isLoading, isError, refetch, isFetching } = useQuery({
        queryKey: ["restaurants", { limit: visibleCount }],
        queryFn: () => fetchRestaurants(visibleCount),
    });

    // Canteen closed today (school date override / operating hours) → dedicated "closed" screen.
    useEffect(() => {
        const sel = readSelection();
        if (!sel) return;
        getDayStatus(sel.schoolId).then((s) => { if (!s.isOpen && !(process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEBUG_ALWAYS_OPEN === "true")) router.replace("/user/closed"); }).catch(() => undefined);
    }, [router]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return restaurants.filter((r) => (category === "all" || (r.categories as string[]).includes(category)) && (!q || r.name.toLowerCase().includes(q)));
    }, [restaurants, search, category]);
    const openCount = restaurants.filter((r) => r.isActuallyOpen).length;

    useEffect(() => {
        try { if (!localStorage.getItem("order-before-lunch-modal")) setShowModal(true); } catch { /* storage blocked */ }
    }, []);

    return (
        <>
            {showModal && (
                <Modal
                    isOpen={showModal}
                    onClose={() => setShowModal(false)}
                    title={`สั่งอาหารก่อน ${CUTOFF_LABEL} น.`}
                    body={`แนะนำให้สั่งอาหารก่อนพักแรก (ก่อน ${CUTOFF_LABEL} น.) เพื่อให้ร้านมีเวลาเตรียมอาหารและรับออเดอร์ได้ทัน\n\nเวลาพักของนักเรียน\nม.1–3  10:40–11:30 น.\nม.4–6  11:30–12:20 น.`}
                    confirmText="เข้าใจแล้ว"
                    onConfirm={() => { try { localStorage.setItem("order-before-lunch-modal", "true"); } catch { /* ignore */ } setShowModal(false); }}
                />
            )}

            <StudentShell active="home">
                <UserHeader>
                    <SearchInput label="ค้นหาร้านหรือเมนู" placeholder="ค้นหาร้าน หรือเมนู" value={search} onChange={(e) => setSearch(e.target.value)} className="!border-0 !text-brand-dark" />
                </UserHeader>

                <main className="flex flex-1 flex-col gap-[18px] p-(--gutter) [--gutter:clamp(16px,3vw,28px)]">
                    <ActiveOrderCard />

                    <Notice tone="orange" icon="clock"><span className="leading-normal"><b>สั่งก่อน {CUTOFF_LABEL} น.</b> เพื่อให้ร้านเตรียมทันก่อนพัก (ม.1–3 พัก 10:40 · ม.4–6 พัก 11:30)</span></Notice>

                    <div role="tablist" aria-label="ประเภทร้าน" className="mx-[calc(var(--gutter)*-1)] flex gap-2 overflow-x-auto px-(--gutter) pb-1">
                        {[{ label: "ทั้งหมด", value: "all" }, ...buttonLabels].map((c) => (
                            <button key={c.value} type="button" role="tab" aria-selected={category === c.value} onClick={() => setCategory(c.value)}
                                className={clsx("h-11 shrink-0 rounded-full px-4 text-[15px] font-semibold", category === c.value ? "bg-brand-dark text-white" : "border border-line-soft bg-white text-brand-dark")}>
                                {c.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="text-xl font-bold">ร้านในโรงอาหาร</h2>
                        <span className="text-sm text-brand-muted">{isFetching && !isLoading ? "กำลังอัปเดต..." : `เปิดอยู่ ${openCount} จาก ${restaurants.length} ร้าน`}</span>
                    </div>

                    {isLoading && <RestaurantListSkeleton count={6} />}
                    {isError && <ErrorState message="โหลดร้านอาหารไม่สำเร็จ" onRetry={() => refetch()} />}

                    {!isLoading && !isError && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {filtered.length > 0 ? (
                                filtered.map((r, i) => (
                                    <RestaurantProfile
                                        key={r.restaurantId}
                                        name={r.name}
                                        categories={r.categories}
                                        restaurantId={r.restaurantId}
                                        restaurantImg={r.restaurantImg ?? r.profile}
                                        isOpen={r.isActuallyOpen}
                                        isPriority={i < 4}
                                        variant={r.isActuallyOpen ? "isOpen" : "isClose"}
                                    />
                                ))
                            ) : (
                                <div className="col-span-full py-16 text-center text-lg text-brand-muted">ไม่มีร้านอาหารที่พร้อมให้บริการในขณะนี้</div>
                            )}
                        </div>
                    )}

                    {visibleCount <= restaurants.length && !search && category === "all" && (
                        <Button onClick={() => setVisibleCount((n) => n + 12)} type="button" variant="secondary">โหลดเพิ่ม</Button>
                    )}
                </main>
            </StudentShell>
        </>
    );
}

