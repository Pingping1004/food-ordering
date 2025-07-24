"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, signupSchemaType } from "@/schemas/auth/signupSchema";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { api } from "@/lib/api";
import { useAuth } from "@/context/Authcontext";

export default function SignupPage() {
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<signupSchemaType>({
        resolver: zodResolver(signupSchema),
    });

    const router = useRouter();
    const { login } = useAuth();
    const [, setIsLoading] = useState(false);
    const [, setErrorMessage] = useState<string | null>(null);

    const submitForm = async (signupData: signupSchemaType, event?: React.BaseSyntheticEvent) => {
        event?.preventDefault();

        setIsLoading(true);
        setErrorMessage(null);
        try {
            await api.post(`/auth/signup`, signupData);
            alert(`ลงทะเบียนใช้งานสำเร็จ!`);
            await login(signupData.email, signupData.password);
            router.push("/user/restaurant"); // Navigate to the home page
        } catch (error: unknown) {
            if (typeof error === 'object' && error !== null && 'response' in error) {
                const err = error as { response: { status: number; data?: { message?: string } } };

                if (err.response.status === 409) {
                    alert('อีเมลนี้มีผู้ใช้งานแล้ว กรุณาใช้อีเมลอื่น');
                } else if (err.response.data?.message) {
                    setErrorMessage(err.response.data.message);
                    alert(err.response.data.message); // use fresh message directly
                } else {
                    alert('พบข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
                }

            } else if (typeof error === 'object' && error !== null && 'request' in error) {
                alert('เกิดเหตุขัดข้องจากเซิฟเวอร์ กรุณาลองใหม่อีกครั้ง');
            } else {
                alert('ข้อมูลไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container flex items-center justify-center min-w-screen min-h-screen">
            <div className="flex justify-center items-center w-full h-full xl:gap-14 lg:justify-normal md:gap-5 draggable">
                <div className="flex items-center justify-center w-full h-full lg:p-12">
                    <div className="flex items-center justify-center w-full h-full xl:p-10">
                        <form
                            onSubmit={handleSubmit(submitForm)} // Ensure this is correctly set
                            className="flex flex-col w-full h-full p-20 text-center bg-white rounded-3xl"
                        >
                            <h3 className="mb-3 text-4xl font-extrabold text-gray-900">
                                ยังไม่เคยลงทะเบียน?
                            </h3>
                            <p className="mb-16 text-gray-700">
                                กรุณาใส่อีเมลและรหัสผ่านของคุณ
                            </p>

                            <Input
                                type="email"
                                placeholder="อีเมล"
                                label="อีเมล"
                                // name="email"
                                // register={register}
                                {...register('email')}
                                variant={errors.email ? "error" : "primary"}
                                error={errors.email?.message}
                            />

                            <Input
                                type="password"
                                placeholder="รหัสผ่าน"
                                label="รหัสผ่าน"
                                // name="password"
                                // register={register}
                                {...register('password')}
                                variant={errors.password ? "error" : "primary"}
                                error={errors.password?.message}
                            />

                            <div className="flex flex-row justify-end mb-8"></div>
                            <div className="flex justify-center">
                                <Button variant="primary" size="full" type="submit" disabled={isSubmitting}>
                                    สร้างบัญชีผู้ใช้
                                </Button>
                            </div>
                            <p className="mt-6 text-base leading-relaxed text-gray-900">
                                มีบัญชีอยู่แล้ว?{" "}
                                <Link
                                    href="/login"
                                    className="font-[700] text-base text-blue-400 transition duration-500 hover:text-blue-600"
                                >
                                    เข้าสู่ระบบ
                                </Link>
                            </p>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
