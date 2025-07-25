"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { api } from "@/lib/api";
import { Button } from "@/components/Button";
import { MenuItem } from "../../add-menu/[restaurantId]/page";
import { saveAs } from 'file-saver';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as Papa from 'papaparse';
import {
    bulkUploadFormSchema,
    BulkUploadFormValues,
    csvMenuItemSchema,
    CsvMenuItemSchemaType,
    FinalBulkMenuPayloadType,
} from '@/schemas/addMenuSchema';
import { useParams, useRouter } from 'next/navigation';

type CsvDummyRow = {
    name: string;
    description: string;
    price: string;
    maxDaily: string;
    cookingTime: string;
    isAvailable: string;
    originalImageFileNameCsv: string;
};

interface ServerMenuItem extends MenuItem {
    name: string;
    description?: string;
    maxDaily: number;
    cookingTIme: number;
}

interface UploadedImageInfo {
    originalName: string;
    tempId: string;
    tempUrl: string;
}

interface BulkCreateMenuResult {
    message: string;
    createdMenus: ServerMenuItem[];
    totalAttempted: number;
    totalCreated: number;
    totalFailed: number;
}

export default function BulkAddMenuPage() {
    const [loading, setLoading] = useState(false);
    const params = useParams();
    const router = useRouter();
    const restaurantId = params.restaurantId as string;

    const [pageError, setPageError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [, setMenuLists] = useState<ServerMenuItem[]>([]);

    const [menuImagePreviewUrls, setMenuImagePreviewUrls] = useState<string[]>([]);
    const [uploadedImageMetadata, setUploadedImageMetadata] = useState<UploadedImageInfo[]>([]);

    const [, setCsvFileName] = useState<string | null>(null);
    const [parsedCsvData, setParsedCsvData] = useState<CsvMenuItemSchemaType[] | null>(null);
    const [csvParseError, setCsvParseError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
    } = useForm<BulkUploadFormValues>({
        resolver: zodResolver(bulkUploadFormSchema),
        defaultValues: { restaurantId },
    });

    useEffect(() => {
        return () => {
            menuImagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [menuImagePreviewUrls]);

    const handleMenuImageFilesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        menuImagePreviewUrls.forEach(url => URL.revokeObjectURL(url));

        const fileWithUrls = files.map(file => {
            const url = URL.createObjectURL(file);
            return { file, url };
        });

        setMenuImagePreviewUrls(fileWithUrls.map(f => f.url));
        setUploadedImageMetadata(fileWithUrls.map(f => ({
            originalName: f.file.name,
            tempId: Math.random().toString(36).substring(2, 15),
            tempUrl: f.url
        })));

        setPageError(null);
        setSuccessMessage(null);
    }, [menuImagePreviewUrls]);

    const parseCsvRow = (row: Record<string, unknown>, index: number) => {
        const trimmedRow = Object.fromEntries(
            Object.entries(row).map(([k, v]) => [k.trim(), v])
        );
        const result = csvMenuItemSchema.safeParse(trimmedRow);
        if (result.success) return { valid: result.data };
        return {
            error: `Row ${index + 1}: ${result.error.errors.map(err => err.message).join(', ')}`
        };
    };

    const handleCsvFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return setCsvFileName(null);
        setCsvFileName(file.name);

        Papa.parse<Record<string, unknown>>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const parsed: CsvMenuItemSchemaType[] = [];
                const errors: string[] = [];

                results.data.forEach((row, index) => {
                    const { valid, error } = parseCsvRow(row, index);
                    if (valid) parsed.push(valid);
                    if (error) errors.push(error);
                });

                if (errors.length) {
                    setParsedCsvData(null);
                    setCsvParseError(errors.join('\n'));
                } else {
                    setParsedCsvData(parsed);
                    setCsvParseError(null);
                    setSuccessMessage('CSV parsed successfully.');
                }
            },
            error: () => setCsvParseError('Failed to parse CSV')
        });
    }, []);

    const onSubmit = async (data: BulkUploadFormValues) => {
        if (!parsedCsvData?.length) return setPageError('Please upload and parse CSV first.');

        setLoading(true);
        setPageError(null);
        setSuccessMessage(null);

        try {
            const files = Array.from(data.menuImgs || []).filter(f => f instanceof File) as File[];
            let uploadedImages: UploadedImageInfo[] = [];

            // Step 1: Upload image files (if any)
            if (files.length > 0) {
                const formData = new FormData();
                files.forEach(file => formData.append('images', file));

                const { data: response } = await api.post<UploadedImageInfo[]>('/menu/bulk-images', formData);
                uploadedImages = response;
                setUploadedImageMetadata(uploadedImages);
            }

            // Step 2: Map original image name to tempId
            const nameToTempId = new Map(
                uploadedImages.map(img => [img.originalName.toLowerCase(), img.tempId])
            );

            // Step 3: Generate final payload
            const finalPayload: FinalBulkMenuPayloadType = parsedCsvData.map(csv => {
                const imageFileKey = csv.originalImageFileNameCsv?.toLowerCase() || '';
                const tempId = nameToTempId.get(imageFileKey);

                if (csv.originalImageFileNameCsv && !tempId) {
                    throw new Error(`Image '${csv.originalImageFileNameCsv}' not matched.`);
                }

                return {
                    name: csv.name,
                    price: csv.price,
                    maxDaily: csv.maxDaily,
                    cookingTime: csv.cookingTime,
                    isAvailable: csv.isAvailable,
                    imageFileName: tempId,
                    originalFileName: csv.originalImageFileNameCsv,
                };
            });

            // Step 4: Send final payload to create menu items
            console.log('Payload to backend:', {
                restaurantId,
                createMenuDto: finalPayload,
            });
            const { data: result } = await api.post<BulkCreateMenuResult>('/menu/bulk', {
                restaurantId,
                createMenuDto: finalPayload,
            });

            // Step 5: Update local states and redirect
            setMenuLists(prev => [...prev, ...result.createdMenus]);
            setSuccessMessage(`Created ${result.totalCreated} menu items.`);
            alert('Bulk upload successful');
            router.push(`/managed-menu/${restaurantId}`);

            // Step 6: Reset form and clean up states
            reset();
            setParsedCsvData(null);
            setMenuImagePreviewUrls([]);
            setUploadedImageMetadata([]);
        } catch {
            setPageError("Unexpected error during bulk menu upload.");
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateCsvTemplate = useCallback(() => {
        if (!uploadedImageMetadata.length) {
            alert("Upload images first to generate template.");
            return;
        }

        const headers = ["name", "description", "price", "maxDaily", "cookingTime", "isAvailable", "originalImageFileNameCsv"];
        const rows = [headers.map(h => `"${h}"`).join(',')];

        uploadedImageMetadata.forEach(info => {
            const dummy: CsvDummyRow = {
                name: "Menu Name",
                description: "",
                price: "0",
                maxDaily: "100",
                cookingTime: "5",
                isAvailable: "true",
                originalImageFileNameCsv: info.originalName
            };
            rows.push(headers.map(h => `"${(dummy[h as keyof CsvDummyRow])}"`).join(','));
        });

        const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
        saveAs(blob, 'menu_bulk_template.csv');
        setSuccessMessage('CSV template downloaded successfully.');
    }, [uploadedImageMetadata]);

    const isSubmitDisabled = useMemo(() => {
        return loading || !parsedCsvData?.length || !uploadedImageMetadata.length || Object.keys(errors).length > 0;
    }, [loading, parsedCsvData, uploadedImageMetadata, errors]);

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-8">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">เพิ่มเมนูหลายรายการพร้อมกัน</h1>

            {pageError && <p className="text-red-600 font-medium text-center">{pageError}</p>}
            {successMessage && <p className="text-green-600 font-medium text-center">{successMessage}</p>}
            {isSubmitting && <p className="text-blue-600 font-medium text-center">กำลังส่งข้อมูล...</p>}


            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                {/* --- Step 1: Upload Images --- */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-blue-200">
                    <h2 className="text-2xl font-semibold mb-4 text-blue-700">ขั้นตอนที่ 1: อัปโหลดรูปภาพเมนู</h2>
                    <p className="text-gray-700 mb-4">
                        กรุณาเลือกรูปเมนูทั้งหมด (รองรับ PNG, JPEG, WebP ขนาดไม่เกิน 5MB ต่อรูป) <br />
                        ระบบจะเชื่อมรูปเข้ากับชื่อเมนูในไฟล์ CSV อัตโนมัติ
                    </p>
                    <label htmlFor="nativeMenuImgs" className="block text-lg font-semibold mb-2">
                        เลือกรูปเมนู
                    </label>
                    <input
                        type="file"
                        id="nativeMenuImgs"
                        accept="image/png, image/jpeg"
                        multiple
                        className="p-2 border rounded-md w-full bg-green-100 text-green-800" // Added some simple styles
                        {...register("menuImgs")} // Still register it
                        onChange={(e) => { // Manually merge RHF's onChange with your custom one
                            handleMenuImageFilesChange(e);
                            if (register("menuImgs").onChange) {
                                register("menuImgs").onChange(e);
                            }
                        }}
                    />

                    {menuImagePreviewUrls.length > 0 && (
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {menuImagePreviewUrls.map((url) => (
                                <div key={url} className="relative aspect-video w-full">
                                    <Image
                                        src={url}
                                        alt={`ดูรูปเมนู`}
                                        fill // Use fill for responsive images
                                        className="object-cover rounded-lg border border-gray-200"
                                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                    <Button
                        type="button"
                        onClick={handleGenerateCsvTemplate}
                        // disabled={loading || watchedMenuImageFiles.length === 0 || Object.keys(errors).length > 0}
                        className="w-full mt-6 bg-purple-600 hover:bg-purple-700 text-white"
                    >
                        สร้างไฟล์ CSV สำหรับกรอกข้อมูล
                    </Button>
                    <p className="text-sm text-gray-500 mt-2 text-center">
                        (ระบบจะใส่ชื่อไฟล์รูปลงในคอลัมน์ `originalImageFileNameCsv` ให้อัตโนมัติ)
                    </p>
                </div>

                {/* --- Step 2: Upload Filled CSV --- */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-green-200">
                    <h2 className="text-2xl noto-sans-bold mb-4 text-green-700">ขั้นตอนที่ 2: อัปโหลดไฟล์ CSV ที่กรอกแล้ว</h2>
                    <p className="text-gray-700 mb-4 noto-sans-regular">
                        ดาวน์โหลดไฟล์ด้านบน แล้วกรอกข้อมูลให้ครบ จากนั้นอัปโหลดาที่นี่ <br />
                        กรุณาตรวจสอบให้แน่ใจว่าชื่อเมนูตรงกับชื่อไฟล์รูปภาพ เพื่อให้ระบบเชื่อมโยงได้ถูกต้อง
                    </p>
                    <p className="text-red-500 text-base">(ไม่ต้องรวมชื่อตาราง และExport เป็นไฟล์ .CSVเท่านั้น)</p>

                    <input
                        type="file"
                        id="nativeCsvFile"
                        accept=".csv"
                        className="p-2 border rounded-md w-full bg-blue-100 text-blue-800" // Added some simple styles
                        {...register("csvFile")} // Still register it with React Hook Form
                        onChange={(e) => { // Manually merge RHF's onChange with your custom one
                            handleCsvFileChange(e);
                            // Also call RHF's onChange if it exists to update form state
                            // You might need to adjust based on how register.onChange is structured
                            if (register("csvFile").onChange) {
                                register("csvFile").onChange(e);
                            }
                        }}
                    />
                    {/* {errors.csvFile && <p className="text-red-500 text-sm mt-1">{errors.csvFile.message}</p>} */}

                    {csvParseError && (
                        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md text-sm whitespace-pre-wrap overflow-auto max-h-60">
                            <h3 className="font-semibold mb-1">พบข้อผิดพลาดในไฟล์ CSV:</h3>
                            <p>{csvParseError}</p>
                        </div>
                    )}

                    {parsedCsvData && parsedCsvData.length > 0 && !csvParseError && (
                        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-md text-sm">
                            อัปโหลดข้อมูลสำเร็จ {parsedCsvData.length} รายการ
                            <details className="mt-2">
                                <summary className="cursor-pointer text-blue-600 hover:underline font-medium">View Parsed Data (First 5 rows)</summary>
                                <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto max-h-40">
                                    {JSON.stringify(parsedCsvData.slice(0, 5), null, 2)}
                                    {parsedCsvData.length > 5 && "\n... (ตัดตอน)"}
                                </pre>
                            </details>
                        </div>
                    )}
                </div>

                {/* --- Final Submission Button --- */}
                <Button
                    type="submit" // This button now triggers RHF's handleSubmit, which then calls your onSubmit
                    disabled={isSubmitDisabled}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg"
                >
                    {isSubmitting ? 'กำลังประมวลผลข้อมูลเมนู...' : 'ส่งข้อมูลเมนูทั้งหมด'}
                </Button>
            </form>
        </div>
    );
}