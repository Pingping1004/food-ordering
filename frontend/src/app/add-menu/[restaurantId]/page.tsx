"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image'; // For optimized images
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Menu } from '@/components/cookers/Menu';
import { useAuth } from '@/context/Authcontext';
import { api } from '@/lib/api';
import { singleCreateMenuSchema, SingleCreateMenuSchemaType } from '@/schemas/addMenuSchema'; // Adjust path

export type MenuItem = Omit<SingleCreateMenuSchemaType, "menuImg"> & {
  menuId: string;
  createdAt: Date;
  isAvailable: boolean;
  menuImg?: string;
  price: number;
};

function getParamId(param: string | string[] | undefined): string | undefined {
  if (Array.isArray(param)) {
    return param[0]; // Take the first element if it's an array
  }
  // Ensure it's treated as string | undefined, not ParamValue
  return typeof param === 'string' ? param : undefined;
}

export default function AddMenuPage() {
  const params = useParams();
  const restaurantId = getParamId(params.restaurantId);
  console.log('RestaurantId: ', restaurantId, 'type: ', typeof restaurantId);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // State for image preview URL
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // States for API feedback
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiSuccessMessage, setApiSuccessMessage] = useState<string | null>(null);

  // State to hold successfully created menu items (if you want to display them locally)
  const [createdMenusList, setCreatedMenusList] = useState<MenuItem[]>([]);

  const {
    control, // Keep if you use Controller components
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<SingleCreateMenuSchemaType>({
    resolver: zodResolver(singleCreateMenuSchema),
    mode: 'onBlur',
    defaultValues: { // Initialize restaurantId from URL params
      restaurantId: restaurantId,
      name: '',
      price: 1, // Or whatever your min is
      maxDaily: undefined,
      cookingTime: undefined,
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

      // Cleanup function to revoke the URL when the component unmounts
      // or when a new file is selected (watchedMenuImgFile changes)
      return () => URL.revokeObjectURL(url);
    } else {
      setImagePreviewUrl(null); // Clear preview if no file is selected
    }
  }, [watchedMenuImgFile]);

  // --- API Call and Form Submission ---
  const onSubmit: SubmitHandler<SingleCreateMenuSchemaType> = async (data) => {
    setIsApiLoading(true);
    setApiError(null);
    setApiSuccessMessage(null);

    if (!data.restaurantId || typeof data.restaurantId !== 'string') {
        setApiError("Restaurant ID is missing or invalid in form data. Please check the URL.");
        setIsApiLoading(false);
        return;
    }

    try {
      const formData = new FormData();

      // Append all form data fields
      formData.append('restaurantId', data.restaurantId);
      formData.append('name', data.name);
      formData.append('price', data.price.toString()); // Convert number to string for FormData
      if (data.maxDaily !== undefined) formData.append('maxDaily', data.maxDaily.toString());
      if (data.cookingTime !== undefined) formData.append('cookingTime', data.cookingTime.toString());

      // Append the image file if selected
      if (data.menuImg && data.menuImg.length > 0) {
        formData.append('menuImg', data.menuImg[0]);
      } else {
        // Handle case where image is required but not provided
        setApiError("Please select a menu image.");
        setIsApiLoading(false);
        return;
      }

      console.log('Sending FormData for Restaurant ID:', data.restaurantId); // Debugging: Confirm ID here
      console.log('FormData content:', Object.fromEntries(formData.entries()));

      // Perform the API call
      const response = await api.post<MenuItem>(
        `/menu/single`, // Your API endpoint
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data', // Crucial for FormData
          },
        }
      );

      const createdMenuItem: MenuItem = response.data;
      console.log('Create menuItem: ', createdMenuItem);
      setApiSuccessMessage(`Menu "${createdMenuItem.name}" created successfully!`);

      // Add the newly created menu item to the local list (optional, for display)
      setCreatedMenusList((prevList) => [createdMenuItem, ...prevList]);

      reset(); // Reset form fields
      setImagePreviewUrl(null); // Clear preview image
      router.push(`/managed-menu/${restaurantId}`);
    } catch (error) {
      console.error("Error creating menu:", error);
      setApiError("Failed to create menu. Please try again.");

    } finally {
      setIsApiLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-y-10 py-10 px-6">
      <div className="flex justify-between items-center">
        <h2 className="noto-sans-bold text-2xl">เพิ่มเมนู</h2>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push(`/add-menu-bulk/${restaurantId}`)}
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
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-10 gap-y-6">
          {/* Left Column: Image Preview & Upload */}
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

        <Button size="lg" type="submit" disabled={isApiLoading}>
          {isApiLoading ? 'กำลังเพิ่มเมนู...' : 'เพิ่มเมนู'}
        </Button>
      </form>
    </div>
  );
}