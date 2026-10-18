"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { parse } from "papaparse";
import { api } from "@/lib/api";
import { compressImage } from "@/lib/compressImage";
import {
    BULK_DEFAULTS,
    BulkRow,
    duplicateRowIds,
    emptyRow,
    isBlankRow,
    isRowComplete,
    isValidPrice,
    newRowId,
    normalizeName,
    parseMenuLine,
} from "@/lib/bulkMenu";
import type { Menu } from "@/lib/types/menu";
import { toastDanger, toastError, toastSuccess } from "@/components/ui/Toast";
import { CookerShell } from "@/components/cookers/CookerShell";

type Photo = { id: string; file: File; url: string };

type BulkCreateMenuResult = {
    message: string;
    createdMenus: Menu[];
    failedMenus: { item: { name: string }; error: string }[];
    totalAttempted: number;
    totalCreated: number;
    totalFailed: number;
};

const UPLOAD_CHUNK = 4;
const withoutKey = <T,>(obj: Record<string, T>, key: string) =>
    Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key)) as Record<string, T>;
const inputCls =
    "min-h-11 w-full min-w-0 rounded-[10px] border-[1.5px] border-line bg-white px-2.5 text-lg outline-none focus-visible:border-primary-main focus-visible:ring-2 focus-visible:ring-primary-main";

export default function BulkAddMenuPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const restaurantId = params.restaurantId as string;

    const [rows, setRows] = useState<BulkRow[]>(() => [emptyRow(), emptyRow(), emptyRow()]);
    const [cookingTimeMins, setCookingTimeMins] = useState<string>(BULK_DEFAULTS.cookingTimeMins);
    const [maxDaily, setMaxDaily] = useState<string>(BULK_DEFAULTS.maxDaily);
    const [photos, setPhotos] = useState<Record<string, Photo>>({});
    const [tray, setTray] = useState<Photo[]>([]);
    const [selectedTrayId, setSelectedTrayId] = useState<string | null>(null);
    const [tried, setTried] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

    const nameRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const priceRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const pendingFocus = useRef<string | null>(null);
    const pickerRowId = useRef<string | null>(null);
    const rowPickerRef = useRef<HTMLInputElement>(null);
    const trayPickerRef = useRef<HTMLInputElement>(null);
    const csvPickerRef = useRef<HTMLInputElement>(null);
    const liveUrls = useRef<Set<string>>(new Set());

    useEffect(() => {
        const urls = liveUrls.current;
        return () => urls.forEach((u) => URL.revokeObjectURL(u));
    }, []);

    useEffect(() => {
        if (!pendingFocus.current) return;
        nameRefs.current[pendingFocus.current]?.focus();
        pendingFocus.current = null;
    }, [rows]);

    const makePhoto = useCallback(async (file: File): Promise<Photo> => {
        const small = await compressImage(file).catch(() => file);
        const url = URL.createObjectURL(small);
        liveUrls.current.add(url);
        return { id: newRowId(), file: small, url };
    }, []);

    const dropUrl = useCallback((p?: Photo) => {
        if (!p) return;
        URL.revokeObjectURL(p.url);
        liveUrls.current.delete(p.url);
    }, []);

    const duplicates = useMemo(() => duplicateRowIds(rows), [rows]);
    const filled = useMemo(() => rows.filter((r) => !isBlankRow(r)), [rows]);
    const readyCount = useMemo(() => filled.filter((r) => isRowComplete(r) && !duplicates.has(r.id)).length, [filled, duplicates]);
    const incompleteCount = filled.length - filled.filter(isRowComplete).length;

    const cookingOk = /^\d+$/.test(cookingTimeMins) && Number(cookingTimeMins) >= 1 && Number(cookingTimeMins) <= 10;
    const maxDailyOk = /^\d+$/.test(maxDaily) && Number(maxDaily) >= 1;

    const patchRow = (id: string, patch: Partial<BulkRow>) => {
        setServerErrors((e) => (e[id] ? { ...e, [id]: "" } : e));
        setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    };

    const insertRowsAt = (index: number, newRows: BulkRow[], focusId?: string) => {
        pendingFocus.current = focusId ?? newRows[0]?.id ?? null;
        setRows((rs) => [...rs.slice(0, index), ...newRows, ...rs.slice(index)]);
    };

    const removeRow = (id: string) => {
        dropUrl(photos[id]);
        setPhotos((p) => withoutKey(p, id));
        setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : [emptyRow()]));
    };

    const handleNamePaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
        const text = e.clipboardData.getData("text");
        if (!text.includes("\n")) return;
        e.preventDefault();
        const parsed = text
            .split(/\r?\n/)
            .filter((l) => l.trim())
            .map((l) => ({ id: newRowId(), ...parseMenuLine(l) }));
        if (!parsed.length) return;
        const target = rows[index];
        if (isBlankRow(target)) {
            setRows((rs) => [...rs.slice(0, index), ...parsed, ...rs.slice(index + 1)]);
            pendingFocus.current = parsed[parsed.length - 1].id;
        } else {
            insertRowsAt(index + 1, parsed, parsed[parsed.length - 1].id);
        }
    };

    const handlePriceKey = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const next = rows[index + 1];
        if (next) nameRefs.current[next.id]?.focus();
        else insertRowsAt(index + 1, [emptyRow()]);
    };

    /* ---------- photos: per-row slot (add-on 1) and photo tray (add-on 2) ---------- */

    const setRowPhoto = (rowId: string, photo: Photo) => {
        setPhotos((p) => {
            dropUrl(p[rowId]);
            return { ...p, [rowId]: photo };
        });
    };

    const clearRowPhoto = (rowId: string) => {
        dropUrl(photos[rowId]);
        setPhotos((p) => withoutKey(p, rowId));
    };

    const handleSlotClick = (rowId: string) => {
        if (selectedTrayId) {
            const picked = tray.find((t) => t.id === selectedTrayId);
            if (picked) {
                setRowPhoto(rowId, picked);
                setTray((t) => t.filter((x) => x.id !== picked.id));
                setSelectedTrayId(null);
                return;
            }
        }
        pickerRowId.current = rowId;
        rowPickerRef.current?.click();
    };

    const handleRowPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const rowId = pickerRowId.current;
        e.target.value = "";
        if (!file || !rowId) return;
        try {
            setRowPhoto(rowId, await makePhoto(file));
        } catch (err) {
            toastError("เลือกรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", err);
        }
    };

    const handleTrayPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = "";
        if (!files.length) return;
        try {
            const made = await Promise.all(files.map(makePhoto));
            setTray((t) => [...t, ...made]);
        } catch (err) {
            toastError("เลือกรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", err);
        }
    };

    const removeFromTray = (id: string) => {
        dropUrl(tray.find((t) => t.id === id));
        setTray((t) => t.filter((x) => x.id !== id));
        setSelectedTrayId((s) => (s === id ? null : s));
    };

    /* ---------- optional CSV: only fills the grid with name + price ---------- */

    const handleCsvPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        parse<Record<string, string>>(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => h.trim(),
            complete: (res) => {
                const imported = res.data
                    .map((r) => ({ id: newRowId(), name: String(r.name ?? "").trim(), price: String(r.price ?? "").trim() }))
                    .filter((r) => r.name);
                if (!imported.length) {
                    toastDanger("ไม่พบข้อมูลในไฟล์ CSV", "ต้องมีคอลัมน์ name และ price");
                    return;
                }
                setRows((rs) => [...rs.filter((r) => !isBlankRow(r)), ...imported, emptyRow()]);
                toastSuccess(`นำเข้า ${imported.length} รายการ ตรวจสอบก่อนกดเพิ่มเมนู`);
            },
            error: () => toastDanger("อ่านไฟล์ CSV ไม่สำเร็จ"),
        });
    };

    /* ---------- submit: create menus first, then attach photos ---------- */

    const uploadPhotos = async (created: Menu[]) => {
        const menuIdByName = new Map(created.map((m) => [normalizeName(m.name), m.menuId]));
        const jobs = rows
            .map((r) => ({ menuId: menuIdByName.get(normalizeName(r.name)), photo: photos[r.id] }))
            .filter((j): j is { menuId: string; photo: Photo } => !!j.menuId && !!j.photo);

        let failed = 0;
        for (let i = 0; i < jobs.length; i += UPLOAD_CHUNK) {
            const results = await Promise.allSettled(
                jobs.slice(i, i + UPLOAD_CHUNK).map(({ menuId, photo }) => {
                    const fd = new FormData();
                    fd.append("restaurantId", restaurantId);
                    fd.append("menuImg", photo.file);
                    return api.patch(`/menu/single/${menuId}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
                }),
            );
            failed += results.filter((r) => r.status === "rejected").length;
        }
        return { total: jobs.length, failed };
    };

    const handleSubmit = async () => {
        setTried(true);
        if (!cookingOk || !maxDailyOk) {
            toastDanger("ค่าเริ่มต้นไม่ถูกต้อง", "เวลาทำ 1-10 นาที และจำนวนต่อวันอย่างน้อย 1");
            return;
        }
        if (incompleteCount > 0 || duplicates.size > 0) {
            toastDanger("ยังมีบรรทัดที่ไม่ถูกต้อง", "แก้บรรทัดที่ขึ้นกรอบแดงก่อน แล้วกดอีกครั้ง");
            return;
        }
        if (readyCount === 0) return;

        setSubmitting(true);
        setServerErrors({});
        try {
            const toCreate = filled.filter(isRowComplete);
            const { data } = await api.post<BulkCreateMenuResult>("/menu/bulk", {
                restaurantId,
                createMenuDto: toCreate.map((r) => ({
                    name: r.name.trim(),
                    price: Number(r.price),
                    cookingTimeMins: Number(cookingTimeMins),
                    maxDaily: Number(maxDaily),
                })),
            });

            const photoResult = await uploadPhotos(data.createdMenus);
            queryClient.invalidateQueries({ queryKey: ["menus", restaurantId] });

            if (data.totalFailed > 0) {
                const failedKeys = new Map(data.failedMenus.map((f) => [normalizeName(f.item.name), f.error]));
                const errs: Record<string, string> = {};
                const kept = rows.filter((r) => {
                    const err = failedKeys.get(normalizeName(r.name));
                    if (err) errs[r.id] = err;
                    return !!err || isBlankRow(r);
                });
                setRows(kept.length ? kept : [emptyRow()]);
                setServerErrors(errs);
                toastDanger(
                    `เพิ่มสำเร็จ ${data.totalCreated} เมนู ล้มเหลว ${data.totalFailed} เมนู`,
                    "บรรทัดที่ล้มเหลวยังอยู่ในตาราง แก้แล้วกดอีกครั้ง",
                );
                return;
            }

            toastSuccess(`เพิ่มเมนูสำเร็จ ${data.totalCreated} เมนู`);
            if (photoResult.failed > 0) {
                toastDanger(`อัปโหลดรูปไม่สำเร็จ ${photoResult.failed} รูป`, "เพิ่มรูปได้ที่หน้าเมนูของร้าน แตะที่ช่องรูปของเมนูนั้น");
            }
            router.push(`/cooker/restaurant/managed-menu/${restaurantId}`);
        } catch (error: unknown) {
            const code = (error as { response?: { data?: { code?: string } } }).response?.data?.code;
            if (code === "409") {
                toastDanger("ชื่อเมนูซ้ำกับที่มีอยู่แล้ว", "กรุณาเปลี่ยนชื่อเมนูที่ซ้ำ แล้วลองอีกครั้ง");
            } else {
                toastError("เพิ่มเมนูไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", error);
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <CookerShell restaurantId={restaurantId ?? ""} active="menu">
            <div className="mx-auto min-h-app w-full max-w-[720px] space-y-4 lg:max-w-[1200px] xl:max-w-[1400px] lg:px-8 bg-ground px-5 py-6 font-app text-brand-dark">
                <div>
                    <h1 className="text-[28px] font-bold">เพิ่มเมนูหลายรายการ</h1>
                    <p className="mt-1 text-lg text-brand-muted">พิมพ์แค่ชื่อกับราคา รูปจะใส่ตอนนี้หรือทีหลังก็ได้</p>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(300px,400px)_minmax(0,1fr)] lg:items-start">
                    <div className="space-y-4 lg:sticky lg:top-4">
                        {/* defaults */}
                        <section className="rounded-[20px] border border-line-soft bg-white p-4" aria-label="ค่าเริ่มต้นของทุกเมนู">
                            <h2 className="mb-3 text-lg font-bold">ค่าเริ่มต้นของทุกเมนู</h2>
                            <div className="flex flex-wrap gap-4">
                                <label className="grid gap-1 text-[15px] text-brand-muted">
                                    เวลาทำ (นาที)
                                    <input
                                        id="bulkCookingTime"
                                        type="number"
                                        inputMode="numeric"
                                        min={1}
                                        max={10}
                                        value={cookingTimeMins}
                                        onChange={(e) => setCookingTimeMins(e.target.value)}
                                        className={`${inputCls} w-28 ${tried && !cookingOk ? "border-[#B42318] bg-danger-light" : ""}`}
                                    />
                                </label>
                                <label className="grid gap-1 text-[15px] text-brand-muted">
                                    ขายได้สูงสุด (จาน/วัน)
                                    <input
                                        id="bulkMaxDaily"
                                        type="number"
                                        inputMode="numeric"
                                        min={1}
                                        value={maxDaily}
                                        onChange={(e) => setMaxDaily(e.target.value)}
                                        className={`${inputCls} w-36 ${tried && !maxDailyOk ? "border-[#B42318] bg-danger-light" : ""}`}
                                    />
                                </label>
                            </div>
                            <p className="mt-2 text-[15px] text-brand-muted">แก้เป็นรายเมนูได้ทีหลังที่หน้า “แก้ไขเมนู”</p>
                        </section>

                        {/* photo tray */}
                        <section className="rounded-[20px] border border-line-soft bg-white p-4" aria-label="รูปเมนู">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h2 className="text-lg font-bold">รูปเมนู (ไม่บังคับ)</h2>
                                <button
                                    type="button"
                                    onClick={() => trayPickerRef.current?.click()}
                                    className="min-h-11 rounded-xl border-[1.5px] border-line bg-white px-4 text-[15px] font-semibold hover:bg-ground"
                                >
                                    เลือกรูปหลายรูป
                                </button>
                            </div>
                            {tray.length === 0 ? (
                                <p className="mt-2 text-[15px] text-brand-muted">
                                    ข้ามได้เลย เมนูที่ไม่มีรูปจะแสดงรูปแทน และเพิ่มรูปทีหลังได้ หรือเลือกรูปหลายรูปมาวางไว้ตรงนี้ แล้วแตะรูป
                                    จากนั้นแตะช่องรูปของเมนู
                                </p>
                            ) : (
                                <>
                                    <p className="mt-2 text-[15px] text-brand-muted">
                                        {selectedTrayId ? "แตะช่องรูปของเมนูที่ต้องการวางรูปนี้" : "แตะรูปเพื่อเลือก แล้วแตะช่องรูปของเมนู"}
                                    </p>
                                    <ul className="mt-3 flex flex-wrap gap-2">
                                        {tray.map((t) => (
                                            <li key={t.id} className="relative">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedTrayId((s) => (s === t.id ? null : t.id))}
                                                    aria-pressed={selectedTrayId === t.id}
                                                    aria-label="เลือกรูปนี้"
                                                    className={`block overflow-hidden rounded-xl ${selectedTrayId === t.id ? "ring-4 ring-primary-main" : "ring-1 ring-line"}`}
                                                >
                                                    <Image
                                                        src={t.url}
                                                        alt=""
                                                        width={64}
                                                        height={64}
                                                        unoptimized
                                                        className="h-16 w-16 object-cover"
                                                    />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => removeFromTray(t.id)}
                                                    aria-label="เอารูปออก"
                                                    className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-bold text-[#B42318] shadow ring-1 ring-line"
                                                >
                                                    ✕
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                            <input ref={trayPickerRef} type="file" accept="image/*" multiple hidden onChange={handleTrayPicked} />
                            <input ref={rowPickerRef} type="file" accept="image/*" hidden onChange={handleRowPicked} />
                        </section>
                    </div>
                    {/* entry grid */}
                    <section className="rounded-[20px] border border-line-soft bg-white p-4" aria-label="ตารางกรอกเมนู">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <h2 className="text-lg font-bold">กรอกเมนู</h2>
                            <button
                                type="button"
                                onClick={() => csvPickerRef.current?.click()}
                                className="min-h-10 rounded-xl px-3 text-[15px] font-semibold text-primary-dark hover:bg-primary-light"
                            >
                                นำเข้าจาก CSV
                            </button>
                            <input ref={csvPickerRef} type="file" accept=".csv" hidden onChange={handleCsvPicked} />
                        </div>

                        <ul className="grid gap-2.5">
                            {rows.map((r, i) => {
                                const photo = photos[r.id];
                                const nameBad = tried && !isBlankRow(r) && !r.name.trim();
                                const priceBad = tried && !isBlankRow(r) && !isValidPrice(r.price);
                                const dup = duplicates.has(r.id);
                                const serverErr = serverErrors[r.id];
                                return (
                                    <li key={r.id} className="grid gap-1">
                                        <div className="grid grid-cols-[1.25rem_2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 sm:grid-cols-[1.25rem_2.75rem_minmax(0,1fr)_6rem_2.75rem]">
                                            <span className="text-right text-[15px] tabular-nums text-brand-muted">{i + 1}</span>
                                            <div className="relative">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSlotClick(r.id)}
                                                    aria-label={photo ? `เปลี่ยนรูปบรรทัด ${i + 1}` : `เพิ่มรูปบรรทัด ${i + 1}`}
                                                    className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-[10px] border-[1.5px] bg-ground text-brand-muted hover:bg-primary-light ${
                                                        selectedTrayId ? "border-primary-main" : "border-dashed border-line"
                                                    }`}
                                                >
                                                    {photo ? (
                                                        <Image
                                                            src={photo.url}
                                                            alt=""
                                                            width={44}
                                                            height={44}
                                                            unoptimized
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <svg
                                                            width="20"
                                                            height="20"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="1.8"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            aria-hidden="true"
                                                        >
                                                            <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                                                            <circle cx="12" cy="13" r="3.5" />
                                                        </svg>
                                                    )}
                                                </button>
                                                {photo && (
                                                    <button
                                                        type="button"
                                                        onClick={() => clearRowPhoto(r.id)}
                                                        aria-label={`เอารูปบรรทัด ${i + 1} ออก`}
                                                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-[#B42318] shadow ring-1 ring-line"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                            <input
                                                id={`bulkName${i}`}
                                                ref={(el) => {
                                                    nameRefs.current[r.id] = el;
                                                }}
                                                type="text"
                                                autoComplete="off"
                                                placeholder="ชื่อเมนู"
                                                aria-label={`ชื่อเมนูบรรทัด ${i + 1}`}
                                                value={r.name}
                                                onChange={(e) => patchRow(r.id, { name: e.target.value })}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        priceRefs.current[r.id]?.focus();
                                                    }
                                                }}
                                                onPaste={(e) => handleNamePaste(i, e)}
                                                className={`${inputCls} ${nameBad || dup || serverErr ? "border-[#B42318] bg-danger-light" : ""}`}
                                            />
                                            <input
                                                id={`bulkPrice${i}`}
                                                ref={(el) => {
                                                    priceRefs.current[r.id] = el;
                                                }}
                                                type="number"
                                                inputMode="numeric"
                                                min={1}
                                                step={1}
                                                placeholder="ราคา (บาท)"
                                                aria-label={`ราคาบรรทัด ${i + 1}`}
                                                value={r.price}
                                                onChange={(e) => patchRow(r.id, { price: e.target.value })}
                                                onKeyDown={(e) => handlePriceKey(i, e)}
                                                className={`${inputCls} col-start-3 row-start-2 tabular-nums sm:col-start-4 sm:row-start-1 ${priceBad ? "border-[#B42318] bg-danger-light" : ""}`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeRow(r.id)}
                                                aria-label={`ลบบรรทัด ${i + 1}`}
                                                title="ลบ"
                                                className="col-start-4 row-start-1 flex h-11 w-11 items-center justify-center rounded-[10px] border-[1.5px] border-line bg-white text-[#B42318] hover:bg-danger-light sm:col-start-5"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                        {(dup || serverErr) && (
                                            <p className="pl-[1.75rem] text-[15px] text-[#B42318]">
                                                {dup ? "ชื่อนี้ซ้ำกับบรรทัดก่อนหน้า" : serverErr}
                                            </p>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>

                        <p className="mt-3 text-[15px] text-brand-muted">
                            Enter ที่ช่องราคาเพื่อขึ้นบรรทัดใหม่ · วางข้อความหลายบรรทัดในช่องชื่อได้ เช่น “ข้าวผัดกุ้ง 60”
                        </p>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
                            <p className="text-[17px]" aria-live="polite">
                                <b className="tabular-nums">{readyCount}</b> เมนูพร้อมเพิ่ม
                                {tried && incompleteCount > 0 && (
                                    <span className="font-semibold text-[#B42318]"> · {incompleteCount} บรรทัดยังไม่ครบ</span>
                                )}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => insertRowsAt(rows.length, [emptyRow()])}
                                    className="min-h-12 rounded-xl border-[1.5px] border-line bg-white px-4 text-[17px] font-semibold hover:bg-ground"
                                >
                                    + เพิ่มบรรทัด
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={submitting || readyCount === 0}
                                    className="min-h-12 rounded-xl bg-primary-main px-5 text-[17px] font-bold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {submitting ? "กำลังเพิ่มเมนู..." : "เพิ่มเมนูทั้งหมด"}
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </CookerShell>
    );
}
