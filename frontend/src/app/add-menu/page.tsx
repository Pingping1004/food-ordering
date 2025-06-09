"use client";

import React, { useState } from "react";
import { SubmitHandler, useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createMenuSchema, createMenuSchemaType } from "@/schemas/menuSchema";
import { v4 as uuidv4 } from "uuid";

import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Menu } from "@/components/cookers/Menu";

export type MenuItem = Omit<createMenuSchemaType, "menuImg"> & {
  id: string;
  createdAt: Date;
  isAvailable: boolean;
  menuImg?: File | string; // single File after extraction
};

export default function AddMenuPage() {
  const [menuList, setMenuList] = useState<MenuItem[]>([]);
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<createMenuSchemaType>({
    resolver: zodResolver(createMenuSchema),
    mode: "onBlur",
  });

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
        menuImg: previewUrl,
      };

      setMenuList((prevMenuList) => [...prevMenuList, newMenu]);

      console.log("Created menu: ", newMenu);
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
        <div className="grid grid-cols-2 h-full md:justify-between justify-center items-center md:gap-x-10 gap-x-6">
          <Controller
            control={control}
            name="menuImg"
            defaultValue={undefined}
            render={({ field }) => (
              <Input
                type="file"
                placeholder="รูปภาพเมนู"
                label="รูปภาพเมนู (ไม่บังคับ)"
                accept="image/*"
                multiple={false}
                variant={errors.menuImg ? "error" : "primary"}
                {...field}
                onChange={(event) =>
                  field.onChange((event.target as HTMLInputElement).files)
                }
              />
            )}
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
              error={errors.price?.message}
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
            error={errors.maxDaily?.message}
          />

          <Input
            type="text"
            placeholder="3นาที, 5นาที"
            label="เวลาในการปรุง(นาที)"
            name="cookingTime"
            register={register}
            variant={errors.cookingTime ? "error" : "primary"}
            className="flex w-1/2"
            error={errors.cookingTime?.message}
          />
        </div>
        <Button size="full" type="submit" disabled={isSubmitting}>
          เพิ่มเมนู
        </Button>
      </form>

      <div>
        {menuList.map((menu) => {
          const src =
            typeof menu.menuImg === "string" ? menu.menuImg : "/picture.svg";
          return (
            <Menu
              menuImg={src}
              key={menu.id}
              menuId={menu.id}
              name={menu.name}
              price={menu.price}
              maxDaily={menu.maxDaily}
              cookingTime={menu.cookingTime}
              restaurantName="Somchai sushi"
              createdAt={new Date()}
              isAvailable={true}
            />
          );
        })}
      </div>
    </div>
  );
}
