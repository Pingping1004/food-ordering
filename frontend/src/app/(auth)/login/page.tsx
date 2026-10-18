"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, loginSchemaType } from "@/schemas/auth/loginSchema";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/auth/auth.hooks";
import { toastDanger } from "@/components/ui/Toast";
import { postLoginPath } from "@/auth/access";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<loginSchemaType>({
        resolver: zodResolver(loginSchema),
        mode: 'onBlur',
    });

    const router = useRouter();
    const { login } = useAuth();

    const onError = (formErrors: typeof errors) => {
        const messages = Object.entries(formErrors)
            .map(([, error]) => `• ${error?.message || "ข้อมูลช่องนี้ไม่ถูกต้อง"}`)
            .join('\n');

        toastDanger(`กรุณากรอกข้อมูลให้ถูกต้อง:\n\n${messages}`);
    };

    const submitForm = async (loginData: loginSchemaType) => {
        try {
            const user = await login(loginData.email, loginData.password);

            const next = new URLSearchParams(window.location.search).get("next");
            router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : postLoginPath(user));
        } catch {
            // AuthProvider.login already toasted the specific reason (wrong password, unknown account…).
        }
    };

    return (
        <div className="min-h-screen bg-ground sm:flex sm:items-center sm:justify-center sm:p-6">
            <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col gap-7 bg-white px-6 pb-7 pt-8 font-app text-brand-dark sm:min-h-0 sm:rounded-3xl sm:border sm:border-line-soft sm:py-10">
                <div className="flex items-center gap-2.5">
                    <Logo size={44} />
                    <span className="text-xl font-bold">PromptServe</span>
                </div>

                <div className="flex flex-col gap-2">
                    <h1 className="text-[30px] font-bold leading-tight">เข้าสู่ระบบ</h1>
                    <p className="text-base leading-relaxed text-brand-muted">
                        ใช้บัญชีเดียวกันได้ทั้งนักเรียน ร้านค้า และเจ้าหน้าที่โรงเรียน
                    </p>
                </div>

                <form onSubmit={handleSubmit(submitForm, onError)} className="flex flex-col gap-[18px]">
                    <Input
                        type="email"
                        label="อีเมล"
                        placeholder="name@school.ac.th"
                        autoComplete="email"
                        {...register('email')}
                        variant={errors.email ? "error" : "primary"}
                        error={errors.email?.message}
                    />
                    <Input
                        type="password"
                        label="รหัสผ่าน"
                        placeholder="รหัสผ่าน"
                        autoComplete="current-password"
                        {...register('password')}
                        variant={errors.password ? "error" : "primary"}
                        error={errors.password?.message}
                    />
                    <Button variant="primary" size="full" type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "กำลังโหลด..." : "เข้าสู่ระบบ"}
                    </Button>
                </form>

                <Link href="/forgot-password" className="-mt-2 self-center text-[15px] font-semibold text-primary-dark hover:text-primary-main">
                    ลืมรหัสผ่าน?
                </Link>

                <p className="mt-auto text-center text-[15px] text-brand-muted">
                    ยังไม่มีบัญชี?{" "}
                    <Link href="/signup" className="font-bold text-primary-dark hover:text-primary-main">
                        สมัครสมาชิก
                    </Link>
                </p>
            </div>
        </div>
    );
}
