"use client";

import Image from 'next/image';
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { useAuth } from '@/context/Authcontext';
import React, { useEffect, useState } from 'react'
import TimePickerInput from '@/components/ui/TimePicker';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { createRestaurantSchema, CreateRestaurantSchemaType } from '@/schemas/addRestaurant';
import { api } from '@/lib/api';
import { buttonLabels, shortEngDays } from '@/common/restaurant.enum';
import { getCurrentTime, getApproxCloseTime } from '@/util/time';
import { useToggle } from '@/hook/useToggle';
import { useRouter } from 'next/navigation';

export default function RestaurantRegisterPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const {
        variants: categoryVariants,
        selected: categories,
        toggle: toggleCategory,
    } = useToggle(buttonLabels, 3);
    const {
        variants: dateWeekVariants,
        selected: openDate,
        toggle: toggleDateWeek,
    } = useToggle(shortEngDays, 7);

    const {
        control,
        register,
        handleSubmit,
        watch,
        formState: { errors, isSubmitting }
    } = useForm({
        resolver: zodResolver(createRestaurantSchema),
        defaultValues: {
            name: '',
            openTime: getCurrentTime(),
            closeTime: getApproxCloseTime(),
            avgCookingTime: 5,
            adminName: '',
            adminSurname: '',
            adminTel: '',
            adminEmail: '',
        },
        mode: 'onBlur',
    });
    const watchedMenuImgFile = watch('restaurantImg');

    useEffect(() => {
        if (watchedMenuImgFile && watchedMenuImgFile.length > 0) {
            const file = watchedMenuImgFile[0];
            const url = URL.createObjectURL(file);
            setImagePreviewUrl(url);

            // Cleanup function to revoke the URL when the component unmounts
            // or when a new file is selected (watchedMenuImgFile changes)
            return () => URL.revokeObjectURL(url);
        } else {
            setImagePreviewUrl(null); // Clear preview if no file is selected
        }
    }, [watchedMenuImgFile]);

    const onError = (formErrors: typeof errors) => {
        const messages = Object.entries(formErrors)
            .map(([field, error]) => `${field}: ${error?.message}`)
            .join('\n');

        alert(`กรุณากรอกข้อมูลให้ถูกต้อง:\n\n${messages}`);
    };

    const submitData = async (data: CreateRestaurantSchemaType) => {
        try {
            if (!user?.userId) {
                alert('กรุณาเข้าสู่ระบบก่อนลงทะเบียนร้านอาหาร');
                return;
            }

            const categoriesList = categories.map((item) => item.value);
            const openDateList = openDate.map((date) => date.value);

            const formData = new FormData();

            if (data.restaurantImg && data.restaurantImg.length > 0) {
                formData.append('restaurantImg', data.restaurantImg[0]);
            }

            formData.append('name', data.name);
            formData.append('email', user.email);

            categoriesList.forEach(category => {
                formData.append('categories', category);
            });

            openDateList.forEach(date => {
                formData.append('openDate', date);
            });

            formData.append('openTime', data.openTime.toString());
            formData.append('closeTime', data.closeTime.toString());
            formData.append('avgCookingTime', data.avgCookingTime.toString());
            formData.append('adminName', data.adminName);
            formData.append('adminSurname', data.adminSurname);
            formData.append('adminTel', data.adminTel);

            if (data.adminEmail !== undefined && data.adminEmail !== null) {
                formData.append('adminEmail', data.adminEmail);
            }

            const response = await api.post('/restaurant', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                }
            });

            const restaurantName = response.data.result.name;
            const restaurantId = response.data.result.restaurantId
            alert(`ลงทะเบียนร้าน ${restaurantName} สำเร็จ`);
            router.push(`/cooker/${restaurantId}`)
        } catch (error) {
            console.error(`error`, error);
        }
    }

    return (
        <div>
            <form onSubmit={handleSubmit(submitData, onError)} className="flex flex-col gap-y-10 py-10 px-6">
                <header className="flex flex-col gap-y-1">
                    <h1 className="text-2xl text-primary noto-sans-bold">ข้อมูลร้านอาหาร</h1>
                    <p className="text-sm text-secondary">กรุณาระบุข้อมูลอย่างครบถ้วน</p>
                </header>

                <div className="flex flex-col items-center justify-center">
                    {/* Image Preview */}
                    <div className="mb-4">
                        {imagePreviewUrl ? (
                            <Image
                                src={imagePreviewUrl}
                                alt="Preview menu image"
                                className="w-48 h-48 object-cover rounded-lg border border-gray-300 shadow-sm"
                                width={192} // Match w-48 (192px)
                                height={192} // Match h-48 (192px)
                            />
                        ) : (
                            <div className="w-48 h-48 bg-gray-100 flex items-center justify-center rounded-lg border border-gray-300 text-gray-400">
                No Image Selected
                            </div>
                        )}
                    </div>

                    {/* File Input */}
                    <div className="w-full max-w-xs">
                        <label htmlFor="restaurantImg" className="block text-sm font-medium text-gray-700 mb-1">รูปภาพเมนู</label>
                        <Input
                            type="file"
                            id="restaurantImg"
                            placeholder="รูปโปรไฟล์ร้านอาหาร"
                            accept="image/*"
                            multiple={false} // Ensure only one file can be selected
                            error={errors.restaurantImg?.message as string | undefined}
                            {...register('restaurantImg')}
                        />
                    </div>
                </div>

                <Input
                    type="text"
                    label="ชื่อร้านอาหาร"
                    placeholder="ตัวอย่าง: สมชายซูชิ"
                    {...register('name')}
                />
                {errors.name && <p className="text-danger-main text-sm">{errors.name.message}</p>}

                <section className="flex flex-col gap-y-6">
                    <div className="flex gap-x-2 items-end">
                        <h2 className="text-lg text-primary noto-sans-bold">เลือกประเภทของร้านอาหาร</h2>
                        <p className="text-light text-sm">(ไม่เกิน3)</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {buttonLabels.map((item, index) => (
                            <Button
                                key={item.value}
                                type="button"
                                size="select"
                                variant={categoryVariants[index]}
                                onClick={() => toggleCategory(index)}
                            >
                                {item.label}
                            </Button>
                        ))}
                    </div>
                </section>

                <main className="flex flex-col gap-y-6">
                    <h2 className="text-lg noto-sans-bold">ช่วงเวลาเปิดร้าน</h2>
                    <label className="text-secondary text-sm -mb-4">วันที่เปิดขาย</label>
                    <div className="flex flex-wrap gap-2">
                        {shortEngDays.map((item, index) => (
                            <Button
                                key={item.value}
                                type="button"
                                size="lg"
                                variant={dateWeekVariants[index]}
                                onClick={() => toggleDateWeek(index)}
                            >
                                {item.label}
                            </Button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-x-4">
                        <div>
                            <p className="text-secondary text-sm mb-2">เวลาเปิด</p>
                            <Controller
                                name="openTime"
                                control={control}
                                render={({ field }) => (
                                    <TimePickerInput
                                        value={field.value}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                        name={field.name}
                                    />
                                )}
                            />
                        </div>

                        <div>
                            <p className="text-secondary text-sm mb-2">เวลาปิด</p>
                            <Controller
                                name="closeTime"
                                control={control}
                                render={({ field }) => (
                                    <TimePickerInput
                                        value={field.value}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                        name={field.name}
                                    />
                                )}
                            />
                        </div>
                    </div>

                    <Input
                        type="number"
                        label="เวลาในการทำอาหารเฉลี่ย/จาน (นาที)"
                        placeholder='เช่น 3, 5'
                        {...register('avgCookingTime')}
                    />
                    {errors.avgCookingTime && <p className="text-danger-main text-sm">{errors.avgCookingTime.message}</p>}
                </main>

                <footer className="flex flex-col gap-y-6">
                    <h2 className="noto-sans-bold text-base text-primary">ข้อมูลติดต่อผู้ดูแลร้าน</h2>
                    <div className="flex justify-betwee gap-x-4">
                        <div>
                            <Input
                                type="text"
                                label="ชื่อจริง"
                                placeholder="สมชาย"
                                {...register('adminName')}
                                error={errors.adminName?.message}
                            />
                        </div>

                        <div>
                            <Input
                                type="text"
                                label="นามสกุล"
                                placeholder="ใจรัก"
                                {...register('adminSurname')}
                                error={errors.adminSurname?.message}
                            />
                        </div>
                    </div>

                    <Input
                        type="text"
                        label="เบอร์ติดต่อ"
                        placeholder="0xxxxxxxxx"
                        {...register('adminTel')}
                        error={errors.adminTel?.message}
                    />

                    <Input
                        type="email"
                        label="อีเมล (ไม่บังคับ)"
                        placeholder="example@gmail.com"
                        {...register('adminEmail')}
                        error={errors.adminEmail?.message}
                    />
                </footer>

                <Button
                    type="submit"
                    size="full"
                    className="py-4 noto-sans-bold"
                    disabled={isSubmitting}
                >
          ยืนยัน
                </Button>
            </form>
        </div>
    )
}