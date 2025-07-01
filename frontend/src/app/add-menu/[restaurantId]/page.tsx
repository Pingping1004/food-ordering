"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { SubmitHandler, useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createMenuSchema, createMenuSchemaType } from "@/schemas/addMenuSchema";
import { v4 as uuidv4 } from "uuid";

import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Menu } from "@/components/cookers/Menu";
import { api } from "@/lib/api";

export type MenuItem = Omit<createMenuSchemaType, "menuImg"> & {
  id: string;
  createdAt: Date;
  isAvailable: boolean;
  menuImg?: string; // single File after extraction'
  price: number;
};

export default function AddMenuPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [menuList, setMenuList] = useState<MenuItem[]>([]);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<createMenuSchemaType>({
    resolver: zodResolver(createMenuSchema),
    mode: "onBlur",
  });

  useEffect(() => {
    console.log('Menu list:', menuList);
  }, [menuList]);

  const submitMenu: SubmitHandler<createMenuSchemaType> = async (
    data: createMenuSchemaType
  ) => {
    try {
      const file = data.menuImg?.[0]; // <‑‑ single line
      const previewUrl = file ? URL.createObjectURL(file) : "/picture.svg";

      const newMenu: MenuItem = {
        ...data,
        id: uuidv4(),
        createdAt: new Date(),
        isAvailable: true,
        menuImg: preview || '/picture.svg',
      };

      setMenuList((prevMenuList) => [...prevMenuList, newMenu]);

      console.log("Created menu: ", newMenu);
      setPreview(null)
      reset();
    } catch (error) {
      console.error(error);
      alert("Something went wrong, please try again");
    }
  };

  return (
    <div className="flex flex-col gap-y-10 py-10 px-6">
      <h2 className="noto-sans-bold text-2xl">เพิ่มเมนู</h2>
      <form
        onSubmit={handleSubmit(submitMenu)}
        className="flex flex-col gap-y-10"
      >
        <div className="grid h-full md:justify-between justify-center items-center md:gap-x-10 gap-x-6">
          <div className="grid grid-cols-2 mb-10 items-end">
            {preview && (
              <div className="mt-2">
                <Image src={preview} alt="Preview menu image" className="w-32 h-32 object-cover rounded-lg border" width={163} height={163} />
              </div>
            )}

            <Input
              type="file"
              placeholder="รูปภาพเมนู"
              label="รูปภาพเมนู (ไม่บังคับ)"
              accept="image/*"
              multiple={false}
              variant={errors.menuImg ? "error" : "primary"}
              // error={errors.menuImg?.message}
              {...register('menuImg')}
              onChange={(event) => {
                const file = (event.target as HTMLInputElement).files?.[0];
                if (file) {
                  setPreview(prev => {
                    if (prev) URL.revokeObjectURL(prev);
                    return URL.createObjectURL(file);
                  });
                } else {
                  setPreview(null);
                }
              }}
            />
          </div>

          <div>
            <Input
              type="text"
              placeholder="ตัวอย่าง: ข้าวผัดกุ้ง"
              label="ชื่อเมนู"
              {...register('name')}
              variant={errors.name ? "error" : "primary"}
              // className="flex w-1/2"
              className="flex"
            />

            <Input
              type="text"
              placeholder="50"
              label="ราคา"
              {...register('price')}
              variant={errors.price ? "error" : "primary"}
              // className="flex w-1/2"
              className="flex"
              error={errors.price?.message}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:justify-between justify-center items-center md:gap-x-10 gap-x-6">
          <Input
            type="text"
            placeholder="100จาน"
            label="จำนวนจานมากสุด/วัน"
            {...register('maxDaily')}
            variant={errors.maxDaily ? "error" : "primary"}
            className="flex w-1/2"
            error={errors.maxDaily?.message}
          />

          <Input
            type="text"
            placeholder="3นาที, 5นาที"
            label="เวลาในการปรุง(นาที)"
            {...register('cookingTime')}
            variant={errors.cookingTime ? "error" : "primary"}
            className="flex w-1/2"
            error={errors.cookingTime?.message}
          />
        </div>
        <Button size="full" type="submit" disabled={isSubmitting}>
          เพิ่มเมนู
        </Button>
      </form>

      <footer className="flex flex-col gap-y-4">
        {menuList.map((menu) => {
          const src = typeof menu.menuImg === "string" ? menu.menuImg : "/picture.svg";
          return (
            <Menu
              menuImg={menu.menuImg}
              key={menu.id}
              menuId={menu.id}
              name={menu.name}
              price={menu.price}
              maxDaily={menu.maxDaily}
              cookingTime={menu.cookingTime}
              createdAt={new Date()}
              isAvailable={true}
            />
          );
        })}
      </footer>
    </div>
  );
}
