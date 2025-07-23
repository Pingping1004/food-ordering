"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, loginSchemaType } from "@/schemas/auth/loginSchema";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/context/Authcontext";

export default function LoginPage() {
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<loginSchemaType>({
        resolver: zodResolver(loginSchema),
        mode: 'onBlur',
    });

    const router = useRouter();
    const { login } = useAuth();

    const onError = (formErrors: typeof errors) => {
        const messages = Object.entries(formErrors)
            .map(([field, error]) => `${field}: ${error?.message}`)
            .join('\n');

        alert(`กรุณากรอกข้อมูลให้ถูกต้อง:\n\n${messages}`);
    };

    const submitForm = async (loginData: loginSchemaType) => {
        const user = await login(loginData.email, loginData.password);

        if (user.role === "user") {
            router.push('/user/restaurant');
        } else if (user.role === 'cooker') {
            router.push(`/cooker/${user.restaurant?.restaurantId}`)
        }
    };

    return (
        <div className="container flex items-center justify-center min-w-screen min-h-screen">
            <div className="flex justify-center items-center w-full h-full xl:gap-14 lg:justify-normal md:gap-5 draggable">
                <div className="flex items-center justify-center w-full h-full lg:p-12">
                    <div className="flex items-center justify-center w-full h-full xl:p-10">
                        <form
                            onSubmit={handleSubmit(submitForm, onError)}
                            className="flex flex-col w-full h-full p-20 text-center bg-white rounded-3xl"
                        >
                            <h3 className="mb-3 text-4xl font-extrabold text-gray-900">
                                มีบัญชีอยู่แล้ว?
                            </h3>
                            <p className="mb-16 text-gray-700">
                                ใส่อีเมลและรหัสผ่านของคุณ
                            </p>

                            <Input
                                type="email"
                                label="อีเมล"
                                placeholder="อีเมล"
                                // register={register}
                                {...register('email')}
                                variant={errors.email ? "error" : "primary"}
                                error={errors.email?.message}
                            />

                            <Input
                                type="password"
                                label="รหัสผ่าน"
                                placeholder="รหัสผ่าน"
                                // register={register}
                                {...register('password')}
                                variant={errors.password ? "error" : "primary"}
                                error={errors.password?.message}
                            />

                            <div className="flex flex-row justify-end mb-8">
                            </div>
                            <div className="flex justify-center">
                                <Button
                                    variant="primary"
                                    size="full"
                                    type="submit"
                                    disabled={isSubmitting}
                                >
                                    เข้าสู่ระบบ
                                </Button>
                            </div>
                            <p className="text-sm leading-relaxed text-gray-900">
                                ยังไม่เคยลงทะเบียน?{" "}
                                <Link
                                    href="/signup"
                                    className="font-[700] text-blue-400 transition duration-500 hover:text-blue-600"
                                >
                                    สร้างบัญชีผู้ใช้
                                </Link>
                            </p>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
