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
    const { register, handleSubmit, formState: { errors } } = useForm<loginSchemaType>({
        resolver: zodResolver(loginSchema),
    });

    const router = useRouter();
    const { login } = useAuth();
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
                            onSubmit={handleSubmit(submitForm)}
                            className="flex flex-col w-full h-full p-20 text-center bg-white rounded-3xl"
                        >
                            <h3 className="mb-3 text-4xl font-extrabold text-gray-900">
                  Already Have an Account?
                            </h3>
                            <p className="mb-16 text-gray-700">
                  Enter your email and password
                            </p>

                            <Input
                                type="email"
                                label="Email"
                                placeholder="Email"
                                // register={register}
                                {...register('email')}
                                variant={errors.email ? "error" : "primary"}
                                error={errors.email?.message}
                            />

                            <Input
                                type="password"
                                label="Password"
                                placeholder="Password"
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
                                >
                    Login to Account
                                </Button>
                            </div>
                            <p className="text-sm leading-relaxed text-gray-900">
                  Not Register Yet?{" "}
                                <Link
                                    href="/signup"
                                    className="font-[700] text-blue-400 transition duration-500 hover:text-blue-600"
                                >
                    Signup
                                </Link>
                            </p>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
