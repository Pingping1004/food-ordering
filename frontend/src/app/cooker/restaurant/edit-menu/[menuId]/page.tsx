"use client";

import { useEffect, useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { singleEditMenuSchema, singleEditMenuSchemaType } from "@/schemas/addMenuSchema";
import Image from "next/image";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useParams, useRouter } from "next/navigation";
import LoadingPage from "@/components/LoadingPage";
import { toastDanger, toastSuccess } from "@/components/ui/Toast";
import { useMenuById, useUpdateMenu } from "@/hook/useMenu";

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
      cookingTime: menu.cookingTime ?? undefined,
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
    if (data.cookingTime !== undefined) formData.append('cookingTime', data.cookingTime.toString());
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
          cookingTime: data.cookingTime,
          isAvailable: data.isAvailable,
        },
      },
      {
        onSuccess: () => {
          toastSuccess(`แก้ไขเมนูสำเร็จ`);
          router.push(`/cooker/restaurant/managed-menu/${restaurantId}`);
        },
        onError: () => toastDanger("แก้ไขเมนูล้มเหลว กรุณาลองใหม่อีกครั้ง"),
      }
    );
  };

  const onError = (formErrors: typeof errors) => {
    const messages = Object.entries(formErrors)
      .map(([field, error]) => `${field}: ${error?.message}`)
      .join('\n');
    toastDanger(`กรุณากรอกข้อมูลให้ถูกต้อง:\n\n${messages}`);
  };

  if (isLoading) return <LoadingPage />;

    return (
        <div className="flex flex-col gap-y-10 py-10 px-6">
            <div className="flex justify-between items-center">
                <h2 className="font-noto-thai text-bold text-2xl">เเก้ไขเมนู</h2>
            </div>

            <form onSubmit={handleSubmit(onSubmit, onError)} className="flex flex-col gap-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-10 gap-y-6">
                    {/* Left Column: Image Preview & Upload */}
                    <div className="flex flex-col items-center justify-center">
                        {/* Image Preview */}
                        <div className="mb-4">
                            {imagePreviewUrl ? (
                                <Image
                                    loading="lazy"
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
    );
}