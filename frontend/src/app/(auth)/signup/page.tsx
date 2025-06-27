"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, signupSchemaType } from "@/schemas/auth/signupSchema";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { api } from "@/lib/api";

export default function SignupPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<signupSchemaType>({
    resolver: zodResolver(signupSchema),
  });

  const router = useRouter();

  const submitForm = async (signupData: signupSchemaType, event?: React.BaseSyntheticEvent) => {
    event?.preventDefault();
    console.log("Signup form data:", signupData); // Debugging: log form data
    try {
      console.log("Attempting to navigate to home page...");

      await api.post(`/auth/signup`, signupData);
      alert(`ลงทะเบียนใช้งานสำเร็จ!`);
      router.push("/user/restaurant"); // Navigate to the home page
    } catch (error) {
      console.error("Error during navigation:", error);
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
                Have not Registered Yet?
              </h3>
              <p className="mb-16 text-gray-700">
                Enter your email and password
              </p>

              <Input
                type="email"
                placeholder="Email"
                label="Email"
                name="email"
                register={register}
                variant={errors.email ? "error" : "primary"}
              />
              {errors.email && (
                <span className="text-red-500">{errors.email.message}</span>
              )}

              <Input
                type="password"
                placeholder="Password"
                label="Password"
                name="password"
                register={register}
                variant={errors.password ? "error" : "primary"}
              />
              {errors.password && (
                <span className="text-red-500">{errors.password.message}</span>
              )}

              <div className="flex flex-row justify-end mb-8"></div>
              <div className="flex justify-center">
                <Button variant="primary" size="full" type="submit">
                  Create Account
                </Button>
              </div>
              <p className="text-sm leading-relaxed text-gray-900">
                Already Have an Account?{" "}
                <Link
                  href="/login"
                  className="font-[700] text-blue-400 transition duration-500 hover:text-blue-600"
                >
                  Login
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
