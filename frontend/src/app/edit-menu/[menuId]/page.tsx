"use client";

import React, { useEffect, useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { singleEditMenuSchema, singleEditMenuSchemaType } from "@/schemas/addMenuSchema";
import Image from "next/image";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Menu } from "@/context/MenuContext";
import { getParamId } from "@/util/param";

export default function EditMenuPage() {
    const [menu, setMenu] = useState<Menu>();
    const router = useRouter();
    const [restaurantId, setRestaurantId] = useState<string | undefined>(undefined);
    const params = useParams();
    const menuId = getParamId(params.menuId);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<singleEditMenuSchemaType>({
        resolver: zodResolver(singleEditMenuSchema),
        mode: 'onBlur',
        defaultValues: {
            restaurantId: undefined,
            menuId: menuId,
            name: menu?.name || '',
            menuImg: menu?.menuImg ?? undefined,
            price: menu?.price ?? undefined,
            maxDaily: menu?.maxDaily ?? undefined,
            cookingTime: menu?.cookingTime ?? undefined,
            isAvailable: menu?.isAvailable ?? undefined,
        }
    });

    const watchedMenuImgFile = watch('menuImg');

    useEffect(() => {
        const fetchData = async () => {
            const menuResponse = await api.get<Menu>(`menu/find/${menuId}`);
            setMenu(menuResponse.data);
            setRestaurantId(menuResponse.data.restaurantId);

            reset({
                name: menuResponse.data.name || '',
                price: menuResponse.data.price ?? undefined,
                maxDaily: menuResponse.data.maxDaily ?? undefined,
                cookingTime: menuResponse.data.cookingTime ?? undefined,
                menuImg: (menuResponse.data.menuImg && menuResponse.data.menuImg !== '/') ? menuResponse.data.menuImg : undefined,
                restaurantId: menuResponse.data.restaurantId, // <--- Set restaurantId here too!
            });
        }
        fetchData();
    }, [menuId, reset]);

    // --- Image Preview Logic ---
    useEffect(() => {
        let currentPreviewUrl: string | null = null;
        let createdObjectURL: string | null = null;

        if (watchedMenuImgFile && watchedMenuImgFile instanceof FileList && watchedMenuImgFile.length > 0) {
            const file = watchedMenuImgFile[0];
            const url = URL.createObjectURL(file);
            currentPreviewUrl = url;
            createdObjectURL = url;
        } else if (typeof watchedMenuImgFile === 'string' && watchedMenuImgFile) {
            currentPreviewUrl = watchedMenuImgFile;
        } else if (menu?.menuImg) {
            currentPreviewUrl = menu.menuImg;
        }

        setImagePreviewUrl(currentPreviewUrl);

        return () => {
            if (createdObjectURL) {
                URL.revokeObjectURL(createdObjectURL);
            }
        };
    }, [watchedMenuImgFile, menu?.menuImg]);

    const onSubmit: SubmitHandler<singleEditMenuSchemaType> = async (data) => {
        const formData = new FormData();

        if (restaurantId && restaurantId !== undefined) formData.append('restaurantId', restaurantId);
        if (data.name !== undefined) formData.append('name', data.name);
        if (data.price !== undefined) formData.append('price', data.price.toString());
        if (data.maxDaily !== undefined) formData.append('maxDaily', data.maxDaily.toString());
        if (data.cookingTime !== undefined) formData.append('cookingTime', data.cookingTime.toString());

        if (data.menuImg && data.menuImg.length > 0 && !(typeof data.menuImg === 'string' && data.menuImg === '/')) {
            formData.append('menuImg', data.menuImg[0]);
        }

        const response = await api.patch<singleEditMenuSchemaType>(`menu/single/${menuId}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        const updateResult = Array.isArray(response.data) ? response.data : [response.data];
        alert(`แก้ไขเมนู ${updateResult.map(menu => menu.name).join(', ')} สำเร็จ`);
        router.push(`/managed-menu/${restaurantId}`);
    }

    const onError = (formErrors: typeof errors) => {
        const messages = Object.entries(formErrors)
            .map(([field, error]) => `${field}: ${error?.message}`)
            .join('\n');

        alert(`กรุณากรอกข้อมูลให้ถูกต้อง:\n\n${messages}`);
    };

    return (
        <div className="flex flex-col gap-y-10 py-10 px-6">
            <div className="flex justify-between items-center">
                <h2 className="noto-sans-bold text-2xl">เเก้ไขเมนู</h2>
            </div>

            {/* --- API Feedback Messages ---
        {apiSuccessMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
            {apiSuccessMessage}
          </div>
        )}
        {apiError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            {apiError}
          </div>
        )} */}

            <form onSubmit={handleSubmit(onSubmit, onError)} className="flex flex-col gap-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-10 gap-y-6">
                    {/* Left Column: Image Preview & Upload */}
                    <div className="flex flex-col items-center justify-center">
                        {/* Image Preview */}
                        <div className="mb-4">
                            {imagePreviewUrl ? (
                                <Image
                                    priority
                                    src={imagePreviewUrl}
                                    alt="Preview menu image"
                                    className="w-48 h-48 object-cover rounded-lg border border-gray-300 shadow-sm"
                                    width={192}
                                    height={192}
                                />
                            ) : (
                                <div className="w-48 h-48 bg-gray-100 flex items-center justify-center rounded-lg border border-gray-300 text-gray-400">
                                    No Image Selected
                                </div>
                            )}
                        </div>

                        {/* File Input */}
                        <div className="w-full max-w-xs">
                            <label htmlFor="menuImg" className="block text-sm font-medium text-gray-700 mb-1">รูปภาพเมนู</label>
                            <Input
                                type="file"
                                id="menuImg"
                                placeholder="รูปภาพเมนู"
                                accept="image/*"
                                multiple={false} // Ensure only one file can be selected
                                error={errors.menuImg?.message as string | undefined}
                                {...register('menuImg')}
                            // Removed onChange directly here as useEffect with watch handles preview
                            />
                        </div>
                    </div>

                    {/* Right Column: Menu Details */}
                    <div className="flex flex-col gap-y-4">
                        <Input
                            type="text"
                            placeholder="ตัวอย่าง: ข้าวผัดกุ้ง"
                            label="ชื่อเมนู"
                            {...register('name')}
                            error={errors.name?.message}
                        />

                        <Input
                            type="number"
                            placeholder="50"
                            label="ราคา"
                            step="0.01" // Allow decimal for price
                            {...register('price', { valueAsNumber: true })} // Ensure RHF converts to number
                            error={errors.price?.message}
                        />

                        <Input
                            type="number"
                            placeholder="100(ใส่แค่ตัวเลข)"
                            label="จำนวนจานมากสุด/วัน"
                            {...register('maxDaily', { valueAsNumber: true })}
                            error={errors.maxDaily?.message}
                        />

                        <Input
                            type="number"
                            placeholder="3นาที, 5นาที"
                            label="เวลาในการปรุง(นาที)"
                            {...register('cookingTime', { valueAsNumber: true })}
                            error={errors.cookingTime?.message}
                        />
                    </div>
                </div>

                <Button size="lg" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'กำลังเเก้ไขเมนู...' : 'เรียบร้อย'}
                </Button>
            </form>
        </div>
    );
}