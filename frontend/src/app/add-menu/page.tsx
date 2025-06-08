"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { menuSchema, menuSchemaType } from "@/schemas/menuSchema";
import { v4 as uuidv4 } from "uuid";
import { Input } from "@/components/Input";

export default function AddMenuPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<menuSchemaType>({
    resolver: zodResolver(menuSchema),
  });

  return (
    <div className="flex flex-col gap-y-10 py-10 px-6">
      <h2 className="noto-sans-bold text-2xl">เพิ่มเมนู</h2>
      <div>
        <Input
          type="password"
          placeholder="Password"
          label="Password"
          name="password"
          register={register}
          variant={errors.name ? "error" : "primary"}
        />
      </div>
    </div>
  );
}
