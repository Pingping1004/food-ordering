"use client";

import { useEffect, useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { singleEditMenuSchema, singleEditMenuSchemaType } from "@/schemas/addMenuSchema";
import Image from "next/image";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useParams, useRouter } from "next/navigation";
import { FormSkeleton, Skeleton } from "@/components/ui/kit";
import { toastError, toastDanger, toastSuccess } from "@/components/ui/Toast";
import { useMenuById, useUpdateMenu } from "@/hook/useMenu";
import { CookerShell } from "@/components/cookers/CookerShell";

export default function EditMenuPage() {
    const router = useRouter();
  const params = useParams();
  const menuId = params.menuId as string;
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const { data: menu, isLoading } = useMenuById(menuId);

  const restaurantId = menu?.restaurantId ?? '';
  const { mutate: updateMenu } = useUpdateMenu(restaurantId);

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
      menuId,
      name: '',
      restaurantId: undefined,
      menuImg: undefined,
      price: undefined,
      maxDaily: undefined,
      cookingTime: undefined,
      isAvailable: undefined,
    },
  });

  // Populate form once React Query resolves the menu
  useEffect(() => {
    if (!menu) return;
    reset({
      name: menu.name || '',
      price: menu.price ?? undefined,
      maxDaily: menu.maxDaily ?? undefined,
      cookingTime: menu.cookingTimeMins ?? menu.cookingTime ?? undefined,
      menuImg: menu.menuImg && menu.menuImg !== '/' ? menu.menuImg : undefined,
      restaurantId: menu.restaurantId,
      menuId,
    });
  }, [menu, menuId, reset]);

  const watchedMenuImgFile = watch('menuImg');

  useEffect(() => {
    let createdObjectURL: string | null = null;
    let currentPreviewUrl: string | null = null;

    if (watchedMenuImgFile instanceof FileList && watchedMenuImgFile.length > 0) {
      const url = URL.createObjectURL(watchedMenuImgFile[0]);
      currentPreviewUrl = url;
      createdObjectURL = url;
    } else if (typeof watchedMenuImgFile === 'string' && watchedMenuImgFile) {
      currentPreviewUrl = watchedMenuImgFile;
    } else if (menu?.menuImg) {
      currentPreviewUrl = menu.menuImg;
    }

    setImagePreviewUrl(currentPreviewUrl);
    return () => { if (createdObjectURL) URL.revokeObjectURL(createdObjectURL); };
  }, [watchedMenuImgFile, menu?.menuImg]);

  const onSubmit: SubmitHandler<singleEditMenuSchemaType> = (data) => {
    const formData = new FormData();

    if (restaurantId) formData.append('restaurantId', restaurantId);
    if (data.name !== undefined) formData.append('name', data.name);
    if (data.price !== undefined) formData.append('price', data.price.toString());
    if (data.maxDaily !== undefined) formData.append('maxDaily', data.maxDaily.toString());
    if (data.cookingTime !== undefined) formData.append('cookingTimeMins', data.cookingTime.toString());
    if (data.isAvailable !== undefined) formData.append('isAvailable', data.isAvailable.toString());
    if (data.menuImg instanceof FileList && data.menuImg[0] instanceof File) {
      formData.append('menuImg', data.menuImg[0]);
    }

    updateMenu(
      {
        menuId,
        formData,
        optimistic: {
          name: data.name,
          price: data.price,
          maxDaily: data.maxDaily,
          cookingTimeMins: data.cookingTime,
          isAvailable: data.isAvailable,
        },
      },
      {
        onSuccess: () => {
          toastSuccess(`แก้ไขเมนูสำเร็จ`);
          router.push(`/cooker/restaurant/managed-menu/${restaurantId}`);
        },
        onError: (err) => toastError("แก้ไขเมนูไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", err),
      }
    );
  };

  const onError = (formErrors: typeof errors) => {
    const messages = Object.entries(formErrors)
      .map(([, error]) => `• ${error?.message || "ข้อมูลช่องนี้ไม่ถูกต้อง"}`)
      .join('\n');
    toastDanger(`กรุณากรอกข้อมูลให้ถูกต้อง:\n\n${messages}`);
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-app w-full max-w-[640px] md:max-w-[720px] flex-col gap-y-5 bg-ground px-5 py-6 font-app text-brand-dark">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <Skeleton className="h-8 w-40 rounded-xl" />
        </div>
        <div className="rounded-[20px] border border-line-soft bg-white p-5">
          <FormSkeleton fields={5} />
        </div>
      </div>
    );
  }

  return (
        <CookerShell restaurantId={restaurantId ?? ""} active="menu">
        <div className="mx-auto flex min-h-app w-full max-w-[640px] md:max-w-[720px] flex-col gap-y-5 bg-ground px-5 py-6 font-app text-brand-dark">
            <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => router.push(`/cooker/restaurant/managed-menu/${restaurantId}`)} aria-label="กลับไปจัดการเมนู" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-xl hover:bg-white">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <h1 className="flex-1 text-[28px] font-bold">แก้ไขเมนู</h1>
            </div>

            <form onSubmit={handleSubmit(onSubmit, onError)} className="flex flex-col gap-y-5 rounded-[20px] border border-line-soft bg-white p-5">
                <div className="grid grid-cols-1 gap-y-6">
                    {/* Left Column: Image Preview & Upload */}
                    <div className="flex flex-col items-center justify-center">
                        {/* Image Preview */}
                        <div className="mb-4">
                            {imagePreviewUrl ? (
                                <Image
                                    loading="lazy"
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
                                multiple={false}
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

                <Button size="lg" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'กำลังเเก้ไขเมนู...' : 'ยืนยันการแก้ไข'}
                </Button>
            </form>
        </div>
        </CookerShell>
    );
}