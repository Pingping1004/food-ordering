"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { singleCreateMenuSchema, SingleCreateMenuSchemaType } from '@/schemas/addMenuSchema'; // Adjust path
import { toastError, toastDanger } from '@/components/ui/Toast';
import { getParamId } from '@/util/param';
import { useCreateMenu } from '@/hook/useMenu';
import { CookerShell } from "@/components/cookers/CookerShell";

export default function AddMenuPage() {
    const params = useParams();
    const restaurantId = getParamId(params.restaurantId);
    const router = useRouter();

    // State for image preview URL
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors, isLoading, isSubmitting },
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
            .map(([, error]) => `• ${error?.message || "ข้อมูลช่องนี้ไม่ถูกต้อง"}`)
            .join('\n');

        toastDanger(`กรุณากรอกข้อมูลให้ถูกต้อง:\n\n${messages}`);
    };

    const onSubmit: SubmitHandler<SingleCreateMenuSchemaType> = (data) => {
        if (!data.menuImg?.length) {
            toastDanger("ยังไม่ได้เลือกรูปภาพ", "กรุณาเลือกรูปอาหารก่อนกดบันทึก");
            return;
        }

        const formData = new FormData();
        formData.append('restaurantId', data.restaurantId);
        formData.append('name', data.name);
        formData.append('price', data.price.toString());
        if (data.maxDaily !== undefined) formData.append('maxDaily', data.maxDaily.toString());
        if (data.cookingTime !== undefined) formData.append('cookingTimeMins', data.cookingTime.toString());
        formData.append('menuImg', data.menuImg[0]);

        createMenu(
            {
                formData,
                optimistic: {
                    name: data.name,
                    price: data.price,
                    maxDaily: data.maxDaily ?? 0,
                    cookingTimeMins: data.cookingTime ?? 0,
                    menuImg: imagePreviewUrl ?? '',
                    isAvailable: true,
                    restaurantId: restaurantId!,
                },
            },
            {
                onError: (err) => toastError("สร้างเมนูใหม่ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", err),
                onSuccess: () => {
                    reset();
                    router.push(`/cooker/restaurant/managed-menu/${restaurantId}`);
                },
            }
        );
    };

    const { mutate: createMenu } = useCreateMenu(restaurantId || "")

    return (
        <CookerShell restaurantId={restaurantId ?? ""} active="menu">
        <div className="mx-auto flex min-h-app w-full max-w-[640px] md:max-w-[720px] flex-col gap-y-5 bg-ground px-5 py-6 font-app text-brand-dark">
            <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => router.push(`/cooker/restaurant/managed-menu/${restaurantId}`)} aria-label="กลับไปจัดการเมนู" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-xl hover:bg-white">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <h1 className="flex-1 text-[28px] font-bold">เพิ่มเมนู</h1>
                <Button
                    type="button"
                    variant="secondary"
                    onClick={() => router.push(`/cooker/restaurant/add-menu-bulk/${restaurantId}`)}
                >
                    เพิ่มหลายเมนูพร้อมกัน
                </Button>
            </div>

            <form onSubmit={handleSubmit(onSubmit, onError)} className="flex flex-col gap-y-5 rounded-[20px] border border-line-soft bg-white p-5">
                <div className="grid grid-cols-1 gap-y-6">
                    {/* Left Column: Image Preview & Upload */}
                    <div className="flex flex-col items-center justify-center">
                        {/* Image Preview */}
                        <div className="mb-4">
                            {imagePreviewUrl ? (
                                <Image
                                    src={imagePreviewUrl}
                                    alt="Preview menu image"
                                    className="w-48 h-48 object-cover aspect-square rounded-2xl border border-line-soft"
                                    width={192}
                                    height={192}
                                />
                            ) : (
                                <div className="w-48 h-48 bg-ground flex items-center justify-center rounded-2xl border border-line-soft text-brand-muted">
                                    No Image Selected
                                </div>
                            )}
                        </div>

                        {/* File Input */}
                        <div className="w-full max-w-xs">
                            <label htmlFor="menuImg" className="mb-2 block text-[15px] font-semibold">รูปภาพเมนู</label>
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

                <Button size="lg" type="submit" disabled={isLoading || isSubmitting}>
                    {isLoading || isSubmitting ? 'กำลังเพิ่มเมนู...' : 'เพิ่มเมนู'}
                </Button>
            </form>
        </div>
        </CookerShell>
    );
}