"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useAuth } from "@/auth/auth.hooks";
import { useCreateRestaurant } from "@/hook/useCooker";
import { toastDanger, toastError, toastSuccess } from "@/components/ui/Toast";
import { Dialog } from "@/components/ui/Dialog";
import { ActionButton, ChoiceButton, Field, Icon, Notice, SelectInput, TextInput } from "@/components/ui/kit";
import { useMySchool } from "@/hook/useSchool";
import { CATEGORY_LABEL, DAYS, hhmmToMinutes, summarizeHours } from "@/lib/schema/format";
import type { DayOfWeek, RestaurantCategory } from "@/lib/schema";
import { ACCOUNT_TYPE_OPTIONS, BANKS, type AccountType } from "@/common/bank-type.enum";
import { DAY_TOKEN, STEP_SCHEMAS, type RegisterRestaurantValues } from "@/schemas/registerRestaurant";

type Step = 1 | 2 | 3 | 4;
type Values = RegisterRestaurantValues;
type Errors = Partial<Record<keyof Values, string>>;

const INITIAL: Values = {
    contactName: "", contactSurname: "", contactEmail: "",
    name: "", categories: [], contactTel: "", restaurantImg: undefined,
    canteenId: "", location: "", days: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"], openTime: "10:30", closeTime: "14:00", maxActiveOrders: 10, avgCookingTimeMins: 10,
    bankAccount: "", accountName: "", accountNumber: "", paymentQr: undefined,
    consent: false as unknown as true,
};

const TERMS: { title: string; body: string }[] = [
    { title: "1. การอนุมัติร้าน", body: "ใบสมัครจะถูกส่งให้โรงเรียนตรวจสอบ ร้านจะเปิดรับออเดอร์ได้เมื่อโรงเรียนอนุมัติแล้ว และโรงเรียนอาจระงับร้านได้หากพบการใช้งานที่ไม่เหมาะสม" },
    { title: "2. ความถูกต้องของข้อมูล", body: "ข้อมูลเจ้าของร้าน เบอร์ติดต่อ และบัญชีรับเงินต้องเป็นข้อมูลจริงและเป็นของร้าน ผู้สมัครต้องแจ้งแก้ไขหากข้อมูลเปลี่ยน" },
    { title: "3. การรับเงิน", body: "PromptServe ไม่รับหรือโอนเงินแทนร้าน นักเรียนโอนเข้าบัญชีของร้านโดยตรง ระบบใช้ชื่อและเลขบัญชีที่ให้ไว้ตรวจสลิปเท่านั้น ร้านต้องตรวจสอบยอดเงินเข้าบัญชีด้วยตนเอง" },
    { title: "4. การคืนเงิน", body: "การคืนเงินเป็นคำขอแบบแมนนวลที่โรงเรียนเป็นผู้ดูแล ร้านต้องให้ความร่วมมือและคืนเงินให้นักเรียนเองตามที่โรงเรียนตัดสิน ระบบไม่ได้คืนเงินอัตโนมัติ" },
    { title: "5. หน้าที่ของร้าน", body: "ร้านต้องรับ/ปฏิเสธออเดอร์ทันเวลา แจ้งหากล่าช้า ทำอาหารตามที่ระบุ และรักษาความสะอาดตามมาตรฐานของโรงเรียน" },
    { title: "6. ข้อมูลส่วนบุคคล", body: "ระบบเก็บข้อมูลที่ท่านกรอกเพื่อใช้ดำเนินการสมัคร ตรวจสลิป และติดต่อประสานงาน โรงเรียนจะไม่เห็นเลขบัญชีเต็มของร้าน" },
];

const STEP_TITLE: Record<Step, string> = { 1: "ข้อมูลร้าน", 2: "ร้านอยู่ที่ไหน เปิดกี่โมง", 3: "รับเงินเข้าบัญชีไหน", 4: "ตรวจข้อมูลก่อนส่ง" };
const STEP_NAMES = ["ร้าน", "เวลาเปิด", "บัญชีรับเงิน", "ตรวจสอบ"];

function ProgressBar({ step }: Readonly<{ step: Step }>) {
    return (
        <div aria-hidden="true" className="grid grid-cols-4 gap-1.5">
            {[1, 2, 3, 4].map((n) => <span key={n} className={clsx("h-2 rounded-full", n <= step ? "bg-primary-main" : "bg-line")} />)}
        </div>
    );
}

function FilePick({ label, sub, icon, accept, file, onPick, error, big }: Readonly<{ label: string; sub: string; icon: "camera" | "qr"; accept: string; file?: File; onPick: (f: File | undefined) => void; error?: string; big?: boolean }>) {
    const [preview, setPreview] = useState<string | null>(null);
    useEffect(() => {
        if (!file) return setPreview(null);
        const url = URL.createObjectURL(file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    return (
        <div className="flex flex-col gap-2">
            <label className={clsx("flex cursor-pointer items-center gap-3.5 rounded-2xl border-2 border-dashed border-primary-border bg-ground-blue p-4 text-primary-dark focus-within:ring-2 focus-within:ring-primary-main", big && "min-h-[170px] flex-col justify-center text-center")}>
                {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="ตัวอย่างไฟล์ที่เลือก" className={clsx("rounded-xl object-cover", big ? "h-28 w-28" : "h-14 w-14")} />
                ) : (
                    <Icon name={icon} size={big ? 40 : 32} strokeWidth={1.8} />
                )}
                <span className="flex flex-col gap-0.5">
                    <span className="text-xl font-bold">{file ? "เปลี่ยนไฟล์" : label}</span>
                    <span className="text-base text-slate">{file ? file.name : sub}</span>
                </span>
                <input type="file" accept={accept} className="sr-only" onChange={(e) => onPick(e.target.files?.[0])} />
            </label>
            {error && <p role="alert" className="flex items-center gap-1.5 text-base font-medium text-danger-text"><Icon name="alert" size={18} />{error}</p>}
        </div>
    );
}

export function RegisterWizard() {
    const router = useRouter();
    const { user } = useAuth();
    const { mutateAsync: createRestaurant, isPending } = useCreateRestaurant();
    // The school was fixed by the invite code; only its own canteens are offered.
    const { data: school } = useMySchool(true, true);

    const [step, setStep] = useState<Step>(1);
    const [v, setV] = useState<Values>(INITIAL);
    const [errors, setErrors] = useState<Errors>({});
    const [termsOpen, setTermsOpen] = useState(false);

    const set = <K extends keyof Values>(key: K, value: Values[K]) => {
        setV((prev) => ({ ...prev, [key]: value }));
        setErrors((prev) => ({ ...prev, [key]: undefined }));
    };

    const canteen = school?.canteens.find((c) => c.canteenId === v.canteenId);

    // a canteen that was removed/deactivated since it was picked is no longer valid
    // prefill the owner's email from the signed-in account (still editable)
    useEffect(() => {
        if (user?.email) setV((p) => (p.contactEmail ? p : { ...p, contactEmail: user.email }));
    }, [user?.email]);

    useEffect(() => {
        if (school && v.canteenId && !school.canteens.some((c) => c.canteenId === v.canteenId)) setV((p) => ({ ...p, canteenId: "" }));
    }, [school, v.canteenId]);

    // a school with a single canteen needs no choice
    useEffect(() => {
        if (!v.canteenId && school?.canteens.length === 1) setV((p) => ({ ...p, canteenId: school.canteens[0].canteenId }));
    }, [school, v.canteenId]);

    const validate = (s: Step): boolean => {
        const result = STEP_SCHEMAS[s].safeParse(v);
        if (result.success) return true;
        const next: Errors = {};
        result.error.issues.forEach((i) => { const k = i.path[0] as keyof Values; if (k && !next[k]) next[k] = i.message; });
        setErrors(next);
        return false;
    };

    const go = (to: Step) => { setStep(to); window.scrollTo({ top: 0 }); };
    const next = () => { if (validate(step)) go((step + 1) as Step); };

    const toggleCategory = (c: RestaurantCategory) => {
        const has = v.categories.includes(c);
        if (!has && v.categories.length >= 3) return setErrors((p) => ({ ...p, categories: "เลือกได้ไม่เกิน 3 ประเภท" }));
        set("categories", has ? v.categories.filter((x) => x !== c) : [...v.categories, c]);
    };
    const toggleDay = (d: DayOfWeek) => set("days", v.days.includes(d) ? v.days.filter((x) => x !== d) : [...v.days, d]);

    const hoursLine = useMemo(
        () => summarizeHours(v.days.map((d) => ({ dayOfWeek: d, openMinute: hhmmToMinutes(v.openTime), closeMinute: hhmmToMinutes(v.closeTime) }))),
        [v.days, v.openTime, v.closeTime],
    );

    const submit = async () => {
        if (!validate(4)) return;
        if (!user?.userId) return void toastDanger("กรุณาเข้าสู่ระบบก่อน", "ต้องเข้าสู่ระบบจึงจะลงทะเบียนร้านอาหารได้");

        // Field names follow schema.prisma (Restaurant); hours go as openDate/openTime/closeTime until the
        // backend expands them into RestaurantOperatingHour rows.
        const fd = new FormData();
        if (v.restaurantImg) fd.append("restaurantImg", v.restaurantImg as File);
        fd.append("paymentQr", v.paymentQr as File);
        fd.append("name", v.name.trim());
        fd.append("email", user.email);
        fd.append("canteenId", v.canteenId);
        if (v.location.trim()) fd.append("location", v.location.trim());
        v.categories.forEach((c) => fd.append("categories", c));
        fd.append("contactName", v.contactName.trim());
        fd.append("contactSurname", v.contactSurname.trim());
        fd.append("contactTel", v.contactTel);
        fd.append("contactEmail", v.contactEmail.trim());
        fd.append("bankAccount", v.bankAccount);
        fd.append("maxActiveOrders", String(v.maxActiveOrders));
        fd.append("avgCookingTimeMins", String(v.avgCookingTimeMins));
        fd.append("accountName", v.accountName.trim());
        fd.append("accountNumber", v.accountNumber.trim());
        v.days.forEach((d) => fd.append("openDate", DAY_TOKEN[d]));
        fd.append("openTime", v.openTime);
        fd.append("closeTime", v.closeTime);

        try {
            const created = await createRestaurant(fd);
            toastSuccess("ส่งใบสมัครให้โรงเรียนแล้ว");
            router.push(`/cooker/pending/${created.restaurantId}`);
        } catch (error: unknown) {
            const status = (error as { response?: { status?: number } })?.response?.status;
            toastError(status === 409 ? "บัญชีนี้ลงทะเบียนร้านอาหารไว้แล้ว ไม่ต้องสมัครซ้ำ" : "ส่งใบสมัครไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", status === 409 ? undefined : error);
        }
    };

    const groups = [
        { title: "ข้อมูลร้าน", to: 1 as Step, rows: [["เจ้าของร้าน", `${v.contactName} ${v.contactSurname}`.trim()], ["อีเมล", v.contactEmail], ["ชื่อร้าน", v.name], ["ประเภท", v.categories.map((c) => CATEGORY_LABEL[c]).join(", ")], ["เบอร์โทร", v.contactTel]] },
        { title: "ที่ตั้ง & เวลา", to: 2 as Step, rows: [["โรงอาหาร", [canteen?.name ?? "-", v.location.trim()].filter(Boolean).join(" · ")], ["เวลาเปิด", hoursLine], ["รับพร้อมกัน", `${v.maxActiveOrders} ออเดอร์`], ["เวลาทำเฉลี่ย", `${v.avgCookingTimeMins} นาที / เมนู`]] },
        { title: "บัญชีรับเงิน", to: 3 as Step, rows: [["ธนาคาร", v.bankAccount ? BANKS[v.bankAccount as AccountType]?.label : ""], ["ชื่อบัญชี", v.accountName], ["เลขบัญชี", v.accountNumber.length > 4 ? `···· ${v.accountNumber.slice(-4)}` : v.accountNumber], ["QR พร้อมเพย์", v.paymentQr ? "อัปโหลดแล้ว" : "ยังไม่ได้อัปโหลด"]] },
    ];

    return (
        <div className="mx-auto flex min-h-app w-full max-w-[640px] flex-col bg-ground font-app text-brand-dark md:max-w-[720px]">
            <header className="flex flex-col gap-3.5 border-b border-line-soft bg-white px-5 pb-5 pt-4">
                <div className="flex items-center justify-between">
                    {step === 1 ? (
                        <span className="text-lg font-bold text-primary-dark">ขั้นที่ 1 จาก 4</span>
                    ) : (
                        <button type="button" onClick={() => go((step - 1) as Step)} className="flex min-h-11 items-center gap-1 text-[17px] font-semibold">
                            <Icon name="back" size={22} />ย้อนกลับ
                        </button>
                    )}
                    {step === 1 ? (
                        <Link href="/user/account" className="text-[17px] font-semibold text-primary-dark">ขอความช่วยเหลือ</Link>
                    ) : (
                        <span className="text-lg font-bold text-primary-dark">ขั้นที่ {step} จาก 4</span>
                    )}
                </div>
                <ProgressBar step={step} />
                <h1 className="text-[28px] font-bold leading-tight">{STEP_TITLE[step]}</h1>
                {step === 1 && (
                    <ol className="flex flex-wrap gap-x-2 text-[15px] text-brand-muted">
                        {STEP_NAMES.map((n, i) => <li key={n} className={i === 0 ? "font-bold text-primary-dark" : ""}>{i > 0 && "· "}{i + 1} {n}</li>)}
                    </ol>
                )}
            </header>

            <main className="flex flex-1 flex-col gap-[22px] p-5">
                {step === 1 && (
                    <>
                        <section role="group" aria-labelledby="owner-info-title" className="flex flex-col gap-4 rounded-[18px] border border-line-soft bg-white p-[18px]">
                            <h2 id="owner-info-title" className="text-[19px] font-bold">ข้อมูลเจ้าของร้าน</h2>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Field label="ชื่อ" size="xl" error={errors.contactName}>
                                    <TextInput size="xl" autoComplete="given-name" value={v.contactName} invalid={!!errors.contactName} onChange={(e) => set("contactName", e.target.value)} />
                                </Field>
                                <Field label="นามสกุล" size="xl" error={errors.contactSurname}>
                                    <TextInput size="xl" autoComplete="family-name" value={v.contactSurname} invalid={!!errors.contactSurname} onChange={(e) => set("contactSurname", e.target.value)} />
                                </Field>
                            </div>
                            <Field label="อีเมลติดต่อ" size="xl" hint="โรงเรียนใช้ติดต่อเรื่องการอนุมัติร้าน" error={errors.contactEmail}>
                                <TextInput size="xl" type="email" autoComplete="email" value={v.contactEmail} invalid={!!errors.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
                            </Field>
                        </section>

                        <Field label="ชื่อร้าน" size="xl" error={errors.name}>
                            <TextInput size="xl" value={v.name} invalid={!!errors.name} placeholder="เช่น ร้านป้าแดงตามสั่ง" onChange={(e) => set("name", e.target.value)} />
                        </Field>

                        <fieldset className="flex flex-col gap-2.5">
                            <legend className="mb-2.5 text-[19px] font-bold">ร้านขายอะไร? <span className="text-base font-normal text-brand-muted">(เลือกได้ไม่เกิน 3)</span></legend>
                            <div className="grid grid-cols-2 gap-2.5">
                                {(Object.keys(CATEGORY_LABEL) as RestaurantCategory[]).map((c) => {
                                    const on = v.categories.includes(c);
                                    return (
                                        <ChoiceButton key={c} role="checkbox" selected={on} onClick={() => toggleCategory(c)} className="!h-[60px] text-[19px] font-semibold">
                                            {on && <Icon name="check" size={20} strokeWidth={3} />}
                                            {CATEGORY_LABEL[c]}
                                        </ChoiceButton>
                                    );
                                })}
                            </div>
                            {errors.categories && <p role="alert" className="text-base font-medium text-danger-text">{errors.categories}</p>}
                        </fieldset>

                        <Field label="เบอร์โทรร้าน" size="xl" hint="ใช้เบอร์เดียวกับพร้อมเพย์ (ถ้ามี)" error={errors.contactTel}>
                            <TextInput size="xl" type="tel" inputMode="numeric" maxLength={10} value={v.contactTel} invalid={!!errors.contactTel} placeholder="08X XXX XXXX" onChange={(e) => set("contactTel", e.target.value.replace(/\D/g, ""))} />
                        </Field>

                        <FilePick label="รูปหน้าร้าน" sub="ไม่บังคับ" icon="camera" accept="image/*" file={v.restaurantImg as File | undefined} onPick={(f) => set("restaurantImg", f)} />
                    </>
                )}

                {step === 2 && (
                    <>
                        <Field label="โรงอาหาร" size="xl" error={errors.canteenId}>
                            <SelectInput size="xl" value={v.canteenId} disabled={!school} onChange={(e) => set("canteenId", e.target.value)}>
                                <option value="">เลือกโรงอาหาร</option>
                                {school?.canteens.map((c) => <option key={c.canteenId} value={c.canteenId}>{c.name}</option>)}
                            </SelectInput>
                        </Field>
                        <Field label="ล็อก / ตำแหน่งร้าน (ไม่บังคับ)" size="xl" error={errors.location}>
                            <TextInput size="xl" value={v.location} invalid={!!errors.location} placeholder="เช่น ล็อก 5" onChange={(e) => set("location", e.target.value)} />
                        </Field>

                        <fieldset className="flex flex-col gap-2.5">
                            <legend className="mb-2.5 text-[19px] font-bold">เวลาเปิดปกติ</legend>
                            <div className="flex flex-wrap gap-2">
                                {DAYS.map((d) => {
                                    const on = v.days.includes(d.key);
                                    return (
                                        <button key={d.key} type="button" aria-pressed={on} aria-label={d.long} onClick={() => toggleDay(d.key)}
                                            className={clsx("h-12 w-11 rounded-xl text-[17px] font-bold", on ? "bg-primary-main text-white" : "border-[1.5px] border-line bg-white")}>
                                            {d.letter}
                                        </button>
                                    );
                                })}
                            </div>
                            {errors.days && <p role="alert" className="text-base font-medium text-danger-text">{errors.days}</p>}
                            <div className="grid grid-cols-2 gap-2.5">
                                <Field label="เปิด" size="lg" error={errors.openTime}><TextInput size="lg" type="time" value={v.openTime} onChange={(e) => set("openTime", e.target.value)} /></Field>
                                <Field label="ปิด" size="lg" error={errors.closeTime}><TextInput size="lg" type="time" value={v.closeTime} invalid={!!errors.closeTime} onChange={(e) => set("closeTime", e.target.value)} /></Field>
                            </div>
                            <span className="text-[15px] text-brand-muted">แยกเวลารายวันได้ทีหลังในหน้าตั้งค่า</span>
                        </fieldset>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label="รับออเดอร์พร้อมกันได้มากสุด" size="lg" error={errors.maxActiveOrders} hint="ถ้าเต็ม ระบบจะพักรับออเดอร์ใหม่ชั่วคราว (1–50 ออเดอร์)">
                                <TextInput size="lg" inputMode="numeric" value={v.maxActiveOrders || ""} invalid={!!errors.maxActiveOrders} placeholder="เช่น 10" onChange={(e) => set("maxActiveOrders", Number(e.target.value.replace(/\D/g, "").slice(0, 2)))} />
                            </Field>
                            <Field label="เวลาทำอาหารเฉลี่ยต่อเมนู (นาที)" size="lg" error={errors.avgCookingTimeMins} hint="ใช้ประเมินเวลารับอาหารของลูกค้า (1–20 นาที)">
                                <TextInput size="lg" inputMode="numeric" value={v.avgCookingTimeMins || ""} invalid={!!errors.avgCookingTimeMins} placeholder="เช่น 10" onChange={(e) => set("avgCookingTimeMins", Number(e.target.value.replace(/\D/g, "").slice(0, 3)))} />
                            </Field>
                        </div>
                    </>
                )}

                {step === 3 && (
                    <>
                        <FilePick big label="อัปโหลดรูป QR พร้อมเพย์" sub="แคปหน้าจอ QR จากแอปธนาคารของร้าน ระบบจะอ่านชื่อและเลขบัญชีให้" icon="qr" accept="image/*" file={v.paymentQr as File | undefined} onPick={(f) => set("paymentQr", f)} error={errors.paymentQr} />
                        {v.paymentQr ? (
                            <Notice tone="success" icon="check" role="status"><span className="text-base">อัปโหลด QR แล้ว ตรวจข้อมูลด้านล่างให้ตรงกับบัญชีจริง</span></Notice>
                        ) : null}
                        <Field label="ธนาคาร / ประเภทบัญชี" size="xl" error={errors.bankAccount}>
                            <SelectInput size="xl" value={v.bankAccount} onChange={(e) => set("bankAccount", e.target.value)}>
                                <option value="">เลือกธนาคาร</option>
                                {ACCOUNT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.key}</option>)}
                            </SelectInput>
                        </Field>
                        <Field label="ชื่อบัญชี" size="xl" hint="ไม่ต้องใส่คำนำหน้า ต้องตรงกับบัญชีทุกตัวอักษร" error={errors.accountName}>
                            <TextInput size="xl" value={v.accountName} invalid={!!errors.accountName} onChange={(e) => set("accountName", e.target.value)} />
                        </Field>
                        <Field label="เลขบัญชี / เบอร์พร้อมเพย์" size="xl" error={errors.accountNumber}>
                            <TextInput size="xl" inputMode="numeric" value={v.accountNumber} invalid={!!errors.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} />
                        </Field>
                        <Notice tone="orange" icon="shield" className="!text-[15px] !leading-relaxed">
                            ระบบใช้ข้อมูลนี้ตรวจสลิปของนักเรียนว่าโอนเข้าบัญชีร้านจริง โรงเรียนจะไม่เห็นเลขบัญชีเต็ม
                        </Notice>
                    </>
                )}

                {step === 4 && (
                    <>
                        {groups.map((g) => (
                            <section key={g.title} className="flex flex-col gap-2.5 rounded-[18px] border border-line-soft bg-white p-[18px]">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold">{g.title}</h2>
                                    <button type="button" onClick={() => go(g.to)} className="min-h-11 px-2 text-[17px] font-semibold text-primary-dark">แก้ไข</button>
                                </div>
                                {g.rows.map(([k, val]) => (
                                    <div key={k} className="flex justify-between gap-3 text-[17px] leading-snug"><span className="text-brand-muted">{k}</span><span className="text-right font-semibold">{val || "-"}</span></div>
                                ))}
                            </section>
                        ))}
                        <label className="flex items-start gap-3 p-1 text-[17px] leading-normal">
                            <input type="checkbox" checked={!!v.consent} onChange={(e) => set("consent", e.target.checked as true)} className="mt-0.5 h-[26px] w-[26px] shrink-0 accent-primary-main" />
                            ข้อมูลถูกต้อง และยอมรับ <button type="button" onClick={() => setTermsOpen(true)} className="font-semibold text-primary-dark underline">เงื่อนไขการใช้งาน</button>
                        </label>
                        {errors.consent && <p role="alert" className="text-base font-medium text-danger-text">{errors.consent}</p>}
                    </>
                )}
            </main>

            <Dialog open={termsOpen} onClose={() => setTermsOpen(false)} title="เงื่อนไขการใช้งาน" wide>
                <div className="flex flex-col gap-4 text-base leading-relaxed">
                    {TERMS.map((t) => (
                        <section key={t.title} className="flex flex-col gap-1">
                            <h3 className="font-bold">{t.title}</h3>
                            <p className="text-brand-muted">{t.body}</p>
                        </section>
                    ))}
                </div>
                <ActionButton size="lg" full onClick={() => { set("consent", true); setTermsOpen(false); }}>ยอมรับและปิด</ActionButton>
            </Dialog>

            <footer className="sticky bottom-0 border-t border-line-soft bg-white px-5 pb-5 pt-4">
                {step < 4 ? (
                    <ActionButton size="xl" full onClick={next}>ถัดไป</ActionButton>
                ) : (
                    <ActionButton size="xl" full onClick={submit} disabled={isPending}>{isPending ? "กำลังส่ง..." : "ส่งให้โรงเรียนอนุมัติ"}</ActionButton>
                )}
            </footer>
        </div>
    );
}

