"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { ActionButton, Field, Notice, SelectInput, SwitchRow, TextInput } from "@/components/ui/kit";
import { ACCOUNT_TYPES, BANKS, type AccountType } from "@/common/bank-type.enum";
import type { Cooker, RestaurantSettingsPatch } from "@/hook/useCooker";

type EditorProps = Readonly<{
    cooker: Cooker;
    saving: boolean;
    onSave: (patch: RestaurantSettingsPatch) => void;
    onClose: () => void;
}>;

const isWholeNumber = (v: string) => /^\d+$/.test(v.trim());

function Actions({ saving, disabled, onClose }: Readonly<{ saving: boolean; disabled: boolean; onClose: () => void }>) {
    return (
        <div className="flex gap-2.5">
            <ActionButton variant="outline" full onClick={onClose} disabled={saving}>ยกเลิก</ActionButton>
            <ActionButton type="submit" full disabled={disabled || saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</ActionButton>
        </div>
    );
}

/** รับได้พร้อมกันสูงสุด: a number of orders, or no limit (stored as null). */
export function EditMaxOrdersDialog({ cooker, saving, onSave, onClose }: EditorProps) {
    const [unlimited, setUnlimited] = useState(!cooker.maxActiveOrders);
    const [value, setValue] = useState(String(cooker.maxActiveOrders ?? 10));
    const valid = unlimited || (isWholeNumber(value) && Number(value) >= 1 && Number(value) <= 200);

    return (
        <Dialog open onClose={onClose} title="รับได้พร้อมกันสูงสุด">
            <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (valid) onSave({ maxActiveOrders: unlimited ? null : Number(value) });
                }}
            >
                <SwitchRow checked={unlimited} onChange={setUnlimited} label="ไม่จำกัด" sub="รับออเดอร์ได้เรื่อยๆ จนกว่าจะปิดร้านชั่วคราว" />
                {!unlimited && (
                    <Field label="จำนวนออเดอร์ที่ทำพร้อมกันได้" hint="1-200 ออเดอร์ เต็มแล้วระบบจะไม่รับออเดอร์ใหม่" error={valid ? undefined : "กรอกตัวเลข 1-200"}>
                        <TextInput size="lg" type="number" inputMode="numeric" min={1} max={200} value={value} onChange={(e) => setValue(e.target.value)} invalid={!valid} />
                    </Field>
                )}
                <Actions saving={saving} disabled={!valid} onClose={onClose} />
            </form>
        </Dialog>
    );
}

/** เวลาทำอาหารเฉลี่ย (minutes per menu). */
export function EditCookingTimeDialog({ cooker, saving, onSave, onClose }: EditorProps) {
    const [value, setValue] = useState(String(cooker.avgCookingTimeMins ?? 5));
    const valid = isWholeNumber(value) && Number(value) >= 1 && Number(value) <= 60;

    return (
        <Dialog open onClose={onClose} title="เวลาทำอาหารเฉลี่ย">
            <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (valid) onSave({ avgCookingTimeMins: Number(value) });
                }}
            >
                <Field label="นาทีต่อเมนู" hint="ใช้ประมาณเวลารอให้นักเรียน" error={valid ? undefined : "กรอกตัวเลข 1-60"}>
                    <TextInput size="lg" type="number" inputMode="numeric" min={1} max={60} value={value} onChange={(e) => setValue(e.target.value)} invalid={!valid} />
                </Field>
                <Actions saving={saving} disabled={!valid} onClose={onClose} />
            </form>
        </Dialog>
    );
}

/** บัญชีรับเงิน: where payouts go, so the form shows what will change before saving. */
export function EditBankDialog({ cooker, saving, onSave, onClose }: EditorProps) {
    const [bank, setBank] = useState<string>(cooker.bankType ?? "");
    const [name, setName] = useState(cooker.accountName ?? "");
    const [number, setNumber] = useState(cooker.accountNumber ?? "");

    const bankOk = bank in BANKS;
    const nameOk = name.trim().length > 0;
    const numberOk = /^[\d-]{6,}$/.test(number.trim());
    const valid = bankOk && nameOk && numberOk;

    return (
        <Dialog open onClose={onClose} title="บัญชีรับเงิน">
            <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (valid) onSave({ bankAccount: bank, accountName: name.trim(), accountNumber: number.trim() });
                }}
            >
                <Notice tone="orange" icon="alert">
                    <span className="text-[15px]">เงินจากออเดอร์จะโอนเข้าบัญชีนี้ ตรวจสอบเลขบัญชีและชื่อให้ถูกต้องก่อนบันทึก</span>
                </Notice>
                <Field label="ธนาคาร" error={bankOk || !bank ? undefined : "เลือกธนาคาร"}>
                    <SelectInput size="lg" value={bank} onChange={(e) => setBank(e.target.value)}>
                        <option value="" disabled>เลือกธนาคาร</option>
                        {ACCOUNT_TYPES.map((k: AccountType) => (
                            <option key={k} value={k}>{BANKS[k].label}</option>
                        ))}
                    </SelectInput>
                </Field>
                <Field label="ชื่อบัญชี" error={nameOk ? undefined : "กรอกชื่อบัญชี"}>
                    <TextInput size="lg" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} invalid={!nameOk} />
                </Field>
                <Field label="เลขบัญชี" hint="ตัวเลขและเครื่องหมาย - เท่านั้น" error={numberOk || !number ? undefined : "เลขบัญชีไม่ถูกต้อง"}>
                    <TextInput size="lg" inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} invalid={!numberOk && !!number} />
                </Field>
                <Actions saving={saving} disabled={!valid} onClose={onClose} />
            </form>
        </Dialog>
    );
}
