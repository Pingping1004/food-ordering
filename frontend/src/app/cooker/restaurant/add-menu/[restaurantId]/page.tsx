"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { singleCreateMenuSchema, SingleCreateMenuSchemaType } from '@/schemas/addMenuSchema'; // Adjust path
import { toastDanger } from '@/components/ui/Toast';
import { getParamId } from '@/util/param';
import { useCreateMenu } from '@/hook/useMenu';

export default function AddMenuPage() {
    const params = useParams();
    const restaurantId = getParamId(params.restaurantId);
    const router = useRouter();

    // State for image preview URL
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

    // States for API feedback
    const [isApiLoading, setIsApiLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [apiSuccessMessage, setApiSuccessMessage] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
        reset,
    } = useForm<SingleCreateMenuSchemaType>({
        resolver: zodResolver(singleCreateMenuSchema),
        mode: 'onBlur',
        defaultValues: {
            restaurantId: restaurantId,
            name: '',
            price: 50,
            maxDaily: 80,
            cookingTime: 3,
        }
    });

    // Watch the menuImg field specifically for preview logic
    const watchedMenuImgFile = watch('menuImg');

    // --- Image Preview Logic ---
    useEffect(() => {
        if (watchedMenuImgFile && watchedMenuImgFile.length > 0) {
            const file = watchedMenuImgFile[0];
            const url = URL.createObjectURL(file);
            setImagePreviewUrl(url);

            return () => URL.revokeObjectURL(url);
        } else {
            setImagePreviewUrl(null);
        }
    }, [watchedMenuImgFile]);

    const onError = (formErrors: typeof errors) => {
        const messages = Object.entries(formErrors)
            .map(([field, error]) => `${field}: ${error?.message}`)
            .join('\n');

        toastDanger(`กรุณากรอกข้อมูลให้ถูกต้อง:\n\n${messages}`);
    };

    const onSubmit: SubmitHandler<SingleCreateMenuSchemaType> = (data) => {
        if (!data.menuImg?.length) {
            toastDanger("กรุณาเลือกรูปภาพ");
            return;
        }

        const formData = new FormData();
        formData.append('restaurantId', data.restaurantId);
        formData.append('name', data.name);
        formData.append('price', data.price.toString());
        if (data.maxDaily !== undefined) formData.append('maxDaily', data.maxDaily.toString());
        if (data.cookingTime !== undefined) formData.append('cookingTime', data.cookingTime.toString());
        formData.append('menuImg', data.menuImg[0]);

        createMenu(
            {
                formData,
                optimistic: {
                    name: data.name,
                    price: data.price,
                    maxDaily: data.maxDaily ?? 0,
                    cookingTime: data.cookingTime ?? 0,
                    menuImg: imagePreviewUrl ?? '',
                    isAvailable: true,
                    isOrderable: true,
                    sellPriceDisplay: data.price,
                    restaurantId: restaurantId!,
                },
            },
            {
                onError: () => toastDanger("สร้างเมนูใหม่ล้มเหลว กรุณาลองใหม่อีกครั้ง"),
                onSuccess: () => reset(),
            }
        );

        router.push(`/cooker/restaurant/managed-menu/${restaurantId}`);
    };

    if (!restaurantId) return <div>ไม่พบข้อมูลร้านอาหาร</div>;
    const { mutate: createMenu } = useCreateMenu(restaurantId)

    return (
        <div className="flex flex-col gap-y-10 py-10 px-6">
            <div className="flex justify-between items-center">
                <h2 className="font-noto-thai text-bold text-2xl">เพิ่มเมนู</h2>
                <Button
                    type="button"
                    variant="secondary"
                    onClick={() => router.push(`/cooker/restaurant/add-menu-bulk/${restaurantId}`)}
                >
                    เพิ่มหลายเมนูพร้อมกัน
                </Button>
            </div>

            {/* --- API Feedback Messages --- */}
            {apiSuccessMessage && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
                    {apiSuccessMessage}
                </div>
            )}
            {apiError && (
                <div className="bg-red-100 border border-red-400 text-red-500 px-4 py-3 rounded relative">
                    {apiError}
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit, onError)} className="flex flex-col gap-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-10 gap-y-6">
                    {/* Left Column: Image Preview & Upload */}
                    <div className="flex flex-col items-center justify-center">
                        {/* Image Preview */}
                        <div className="mb-4">
                            {imagePreviewUrl ? (
                                <Image
                                    src={imagePreviewUrl}
                                    alt="Preview menu image"
                                    className="w-48 h-48 object-cover aspect-square rounded-lg border border-gray-300 shadow-sm"
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

                <Button size="lg" type="submit" disabled={isApiLoading}>
                    {isApiLoading ? 'กำลังเพิ่มเมนู...' : 'เพิ่มเมนู'}
                </Button>
            </form>
        </div>
    );
}