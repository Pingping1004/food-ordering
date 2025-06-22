"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { editMenuSchema, editMenuSchemaType } from "@/schemas/addMenuSchema";
import { v4 as uuidv4 } from "uuid";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

export default function EditMenu() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<editMenuSchemaType>({
    resolver: zodResolver(editMenuSchema),
  });

  return (
    <div className="flex flex-col gap-y-10 py-10 px-6">
      <h2 className="noto-sans-bold text-2xl">เเก้ไขเมนู</h2>
      <form>
        <div className="grid grid-cols-2 md:justify-between justify-center items-center md:gap-x-10 gap-x-6">
          <Input
            type="file"
            placeholder="รูปภาพเมนู"
            label="รูปภาพเมนู"
            name="menuImg"
            register={register}
            variant={errors.name ? "error" : "primary"}
            className="w-full h-full aria-hidden"
          />

          <div>
            <Input
              type="text"
              placeholder="ตัวอย่าง: ข้าวผัดกุ้ง"
              label="ชื่อเมนู"
              name="name"
              register={register}
              variant={errors.name ? "error" : "primary"}
              className="flex w-1/2"
            />

            <Input
              type="text"
              placeholder="50"
              label="ราคา"
              name="price"
              register={register}
              variant={errors.price ? "error" : "primary"}
              className="flex w-1/2"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:justify-between justify-center items-center md:gap-x-10 gap-x-6">
          <Input
            type="text"
            placeholder="100จาน"
            label="จำนวนจานมากสุด/วัน"
            name="maxDaily"
            register={register}
            variant={errors.maxDaily ? "error" : "primary"}
            className="flex w-1/2"
          />

          <Input
            type="text"
            placeholder="3นาที, 5นาที"
            label="เวลาในการปรุง(นาที)"
            name="maxDaily"
            register={register}
            variant={errors.cookingTime ? "error" : "primary"}
            className="flex w-1/2"
          />
        </div>
      </form>
      <Button
        size="full"
        type="submit"
      >
        <p>เพิ่มเมนู</p>
      </Button>
    </div>
  );
}
