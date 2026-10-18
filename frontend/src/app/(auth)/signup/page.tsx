"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, signupSchemaType } from "@/schemas/auth/signupSchema";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Icon } from "@/components/ui/kit";
import { useAuth } from "@/auth/auth.hooks";
import { toastSuccess } from "@/components/ui/Toast";
import { formatInviteCode } from "@/lib/services/student";

export default function SignupPage() {
    const {
        register,
        control,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<signupSchemaType>({
        resolver: zodResolver(signupSchema),
        defaultValues: { inviteCode: "" },
    });

    const router = useRouter();
    const { signup } = useAuth();

    const submitForm = async (signupData: signupSchemaType) => {
        const code = signupSchema.shape.inviteCode.parse(signupData.inviteCode);
        try {
            // the code goes into Supabase user_metadata so /onboarding still has it after the e-mail-confirm redirect – it decides the role
            const { needsConfirmation } = await signup(signupData.email, signupData.password, signupData.name, "/onboarding", { invite_code: code });
            if (needsConfirmation) {
                toastSuccess("ส่งลิงก์ยืนยันไปที่อีเมลแล้ว กรุณากดลิงก์เพื่อเริ่มใช้งาน");
                return;
            }
            toastSuccess("ลงทะเบียนใช้งานสำเร็จ!");
            router.push("/onboarding");
        } catch {
            /* the provider already showed the reason */
        }
    };

    return (
        <div className="min-h-screen bg-ground sm:flex sm:items-center sm:justify-center sm:p-6">
            <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col gap-[22px] bg-white px-6 pb-7 pt-5 font-app text-brand-dark sm:min-h-0 sm:rounded-3xl sm:border sm:border-line-soft sm:py-10">
                <Link href="/login" aria-label="กลับไปเข้าสู่ระบบ" className="-ml-2.5 flex h-11 w-11 items-center justify-center rounded-xl text-brand-dark hover:bg-ground">
                    <Icon name="back" size={24} />
                </Link>

                <div className="flex flex-col gap-2">
                    <h1 className="text-[30px] font-bold leading-tight">สร้างบัญชี</h1>
                    <p className="text-base leading-relaxed text-brand-muted">ขอรหัสเชิญจากโรงเรียนหรือเจ้าของร้านของคุณ แล้วกรอกด้านล่าง รหัสจะกำหนดว่าคุณเข้าร่วมในฐานะอะไร</p>
                </div>

                <form onSubmit={handleSubmit(submitForm)} className="flex flex-1 flex-col gap-4" noValidate>
                    <Input type="text" label="ชื่อ" placeholder="ชื่อที่ใช้แสดง" autoComplete="name" {...register("name")} variant={errors.name ? "error" : "primary"} error={errors.name?.message} />
                    <Input type="email" label="อีเมล" placeholder="name@school.ac.th" autoComplete="email" {...register("email")} variant={errors.email ? "error" : "primary"} error={errors.email?.message} />
                    <Input type="password" label="รหัสผ่าน" placeholder="รหัสผ่าน" autoComplete="new-password" {...register("password")} variant={errors.password ? "error" : "primary"} error={errors.password?.message} />

                    <Controller
                        control={control}
                        name="inviteCode"
                        render={({ field }) => (
                            <Input
                                type="text"
                                label="รหัสเชิญ"
                                placeholder="ABCD-2345"
                                autoComplete="off"
                                autoCapitalize="characters"
                                spellCheck={false}
                                maxLength={9}
                                className="font-mono tracking-widest"
                                name={field.name}
                                value={field.value}
                                onBlur={field.onBlur}
                                onChange={(e) => field.onChange(formatInviteCode(e.target.value))}
                                variant={errors.inviteCode ? "error" : "primary"}
                                error={errors.inviteCode?.message}
                            />
                        )}
                    />
                    <p className="-mt-1 text-sm text-brand-muted">ผู้ดูแลโรงเรียน: ใช้รหัสที่ผู้ดูแลระบบส่งให้</p>

                    <div className="mt-auto flex flex-col gap-3 pt-4">
                        <Button variant="primary" size="full" type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "กำลังโหลด..." : "สร้างบัญชี"}
                        </Button>
                        <p className="text-center text-[15px] text-brand-muted">
                            มีบัญชีแล้ว?{" "}
                            <Link href="/login" className="font-bold text-primary-dark hover:text-primary-main">
                                เข้าสู่ระบบ
                            </Link>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}
