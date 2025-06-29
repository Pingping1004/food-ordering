"use client";

import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { useAuth } from '@/context/Authcontext';
import React, { useEffect, useState } from 'react'
import TimePickerInput from '@/components/ui/TimePicker';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { createRestaurantSchema, CreateRestaurantSchemaType } from '@/schemas/addRestaurant';
import { api } from '@/lib/api';
import { buttonLabels, KeyValueType, shortEngDays } from '@/common/restaurant.enum';
import { getCurrentTime, getApproxCloseTime } from '@/util/time';
import { useToggle } from '@/hook/useToggle';

export default function RestaurantRegisterPage() {
  const { user } = useAuth();
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
    setValue,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(createRestaurantSchema),
    defaultValues: {
      // userId: user?.userId || '',
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

  useEffect(() => {
    console.log('OpenDate: ', openDate);
  }, [openDate])

  const submitData = async (data: CreateRestaurantSchemaType) => {
    try {
      if (!user?.userId) {
        alert('กรุณาเข้าสู่ระบบก่อนลงทะเบียนร้านอาหาร');
        return;
      }

      const categoriesList = categories.map((item) => item.value);
      const openDateList = openDate.map((date) => date.value);

      const formData = {
        // userId: user?.userId,
        name: data.name,
        email: user.email,
        categories: categoriesList,
        openDate: openDateList,
        openTime: data.openTime,
        closeTime: data.closeTime,
        avgCookingTime: data.avgCookingTime,
        adminName: data.adminName,
        adminSurname: data.adminSurname,
        adminTel: data.adminTel,
        adminEmail: data.adminEmail,
      };

      console.log('Restaurant data: ', formData);
      const response = await api.post('/restaurant', formData);
      console.log('Response data: ', response.data);
      const restaurantName = response.data.result.name;
      alert(`ลงทะเบียนร้าน ${restaurantName} สำเร็จ`);
    } catch (error) {
      console.error(`error`, error);
    }
  }

  console.log('Form errors:', errors);

  return (
    <div>
      <form onSubmit={handleSubmit(submitData)} className="flex flex-col gap-y-10 py-10 px-6">
        <header className="flex flex-col gap-y-1">
          <h1 className="text-2xl text-primary noto-sans-bold">ข้อมูลร้านอาหาร</h1>
          <p className="text-xs text-secondary">การระบุข้อมูลอย่างครบถ้วน สามารถช่วยดึงดูดลูกค้าได้เพิ่มขึ้น</p>
        </header>

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