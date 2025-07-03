"use client";

// import '@/lib/server-shims';

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { api } from "@/lib/api";
import { Button } from "@/components/Button";
import { MenuItem } from "../../add-menu/[restaurantId]/page";
import { saveAs } from 'file-saver';
import { useForm, FieldError, FieldErrorsImpl, Merge } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Menu } from "@/components/cookers/Menu";
import * as Papa from 'papaparse';
import {
    bulkUploadFormSchema,
    BulkUploadFormValues,
    csvMenuItemSchema,
    CsvMenuItemSchemaType,
    FinalBulkMenuPayloadType,
} from '@/schemas/addMenuSchema';
import { useParams } from 'next/navigation';

export interface ServerMenuItem extends MenuItem {
    name: string;
    description?: string;
    maxDaily: number;
    cookingTIme: number;
}

export interface UploadedImageInfo {
    originalName: string;
    tempId: string;
    tempUrl: string;
}

interface BulkCreateMenuResult {
  message: string;
  createdMenus: ServerMenuItem[]; // Or whatever type your created menus have on the frontend
  failedMenus: { item: any; error: string }[]; // Adjust 'any' to your CsvMenuItemData type
  totalAttempted: number;
  totalCreated: number;
  totalFailed: number;
}

export default function BulkAddMenuPage() {
    const [loading, setLoading] = useState(false);
    const params = useParams();
    const restaurantId = params.restaurantId as string;
    // const { user } = useAuth();
    // const restaurantId = user?.restaurant?.restaurantId;
    console.log('Receiving restaurantId: ', restaurantId);
    const [pageError, setPageError] = useState<string | null>(null); // Renamed to avoid conflict with form errors
    const [successMessage, setSuccessMessage] = useState<string | null>(null); // Renamed for consistency
    const [menuList, setMenuLists] = useState<ServerMenuItem[]>([]); // For displaying newly added menus

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        setValue,
        watch, // To get current values of form fields
        reset, // To clear the form after submission
    } = useForm<BulkUploadFormValues>({
        resolver: zodResolver(bulkUploadFormSchema),
        defaultValues: {
            // menuImgs: new DataTransfer().files, // Will only run in the browser
            // csvFile: new DataTransfer().files,   // Will only run in the browser
            restaurantId: restaurantId,
        }
    });

    // --- RHF `watch` for File Inputs to Drive Previews ---
    const watchedMenuImageFiles = watch('menuImgs');
    const watchedCsvFile = watch('csvFile');

    // --- State for Menu Image Previews and Metadata ---
    const [menuImagePreviewUrls, setMenuImagePreviewUrls] = useState<string[]>([]);
    const [uploadedImageMetadata, setUploadedImageMetadata] = useState<UploadedImageInfo[]>([]);

    // Effect for menu image preview URLs cleanup
    useEffect(() => {
        // Clear previous URLs when new files are selected or component unmounts
        return () => {
            menuImagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [menuImagePreviewUrls]);

    // Custom onChange handler for menu image files
    const { onChange: rhfMenuImageFilesOnChange, ...menuImageFilesRegisterProps } = register('menuImgs');
    const handleMenuImageFilesChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        rhfMenuImageFilesOnChange(e as React.ChangeEvent<HTMLInputElement>); // Call RHF's handler

        if (e.target instanceof HTMLInputElement) {
            const files = Array.from(e.target.files || []);
            // Revoke old URLs first
            menuImagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
            // Create new URLs for preview
            const newUrls = files.map((file) => URL.createObjectURL(file));
            setMenuImagePreviewUrls(newUrls);

            const newUploadedMetadata: UploadedImageInfo[] = files.map(file => ({
                originalName: file.name, // The original file name
                tempId: Math.random().toString(36).substring(2, 15), // Generate a temporary ID
                tempUrl: URL.createObjectURL(file) // Create a temporary URL for preview/reference
            }));
            setUploadedImageMetadata(newUploadedMetadata); // Store the generated metadata

            setPageError(null);
            setSuccessMessage(null);
        }
    }, [rhfMenuImageFilesOnChange, menuImagePreviewUrls]);

    // --- State for CSV File Preview and Parsed Data ---
    const [csvFileName, setCsvFileName] = useState<string | null>(null);
    const [parsedCsvData, setParsedCsvData] = useState<CsvMenuItemSchemaType[] | null>(null);
    const [csvParseError, setCsvParseError] = useState<string | null>(null);

    // Custom onChange handler for CSV file
    const { onChange: rhfCsvOnChange, ...csvRegisterProps } = register('csvFile');
    const handleCsvFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        rhfCsvOnChange(e as React.ChangeEvent<HTMLInputElement>); // Call RHF's handler
        setParsedCsvData(null); // Reset previous parse data
        setCsvParseError(null); // Clear previous errors

        if (e.target instanceof HTMLInputElement) {
            const file = e.target.files?.[0];
            if (file) {
                setCsvFileName(file.name);
                Papa.parse(file, {
                    header: true,
                    skipEmptyLines: true,
                    dynamicTyping: false,
                    complete: (results) => {
                        const parsedRows: CsvMenuItemSchemaType[] = [];
                        const rowErrors: string[] = [];

                        results.data.forEach((row: any, index) => {
                            // Trim keys (column headers) from CSV data before parsing with Zod
                            const trimmedRow: { [key: string]: any } = {};
                            for (const key in row) {
                                if (Object.prototype.hasOwnProperty.call(row, key)) {
                                    trimmedRow[key.trim()] = row[key];
                                }
                            }
                            const validationResult = csvMenuItemSchema.safeParse(trimmedRow);
                            if (validationResult.success) {
                                parsedRows.push(validationResult.data);
                            } else {
                                rowErrors.push(`Row ${index + 1}: ${validationResult.error.errors.map(err => err.message).join(', ')}`);
                            }
                        });

                        if (rowErrors.length > 0) {
                            setCsvParseError(`CSV parsing errors:\n${rowErrors.join('\n')}`);
                            setParsedCsvData(null);
                        } else {
                            setParsedCsvData(parsedRows);
                            setCsvParseError(null);
                            setSuccessMessage('CSV file parsed successfully. Review data below.');
                        }
                    },
                    error: (error: any) => {
                        setCsvParseError(`Failed to parse CSV: ${error.message}`);
                        setParsedCsvData(null);
                    },
                });
            } else {
                setCsvFileName(null);
            }
        }
    }, [rhfCsvOnChange]);

    const onSubmit = async (data: BulkUploadFormValues) => {
        console.log('Form submission initiated.');

        if (!parsedCsvData || parsedCsvData.length === 0) {
            setPageError('Please upload and successfully parse a CSV file before submitting.');
            return;
        }

        setLoading(true); // Indicate loading start
        setPageError(null); // Clear previous errors
        setSuccessMessage(null); // Clear previous success messages

        try {
            let uploadedImagesMetadata: UploadedImageInfo[] = [];

            // --- STAGE 1: Upload ALL Menu Images to Temporary Storage (only if images exist) ---
            const filesToUpload = Array.from(data.menuImgs || []); // Ensure it's an array, handle null/undefined
            if (filesToUpload.length > 0) {
                console.log(`Attempting to upload ${filesToUpload.length} images.`);
                const menuImagesFormData = new FormData();
                filesToUpload.forEach((file) => {
                    menuImagesFormData.append('images', file as File);
                });

                // console.log(`Sending FormData to /upload/temp-images. (Note: FormData objects log as [object FormData])`); // This log is not very useful
                const { data: responseData } = await api.post<UploadedImageInfo[]>('/upload/temp-images', menuImagesFormData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                uploadedImagesMetadata = responseData; // Store metadata for display and mapping
                setUploadedImageMetadata(uploadedImagesMetadata);
                console.log(`Successfully uploaded ${uploadedImagesMetadata.length} images to temporary storage.`);
            } else {
                console.log("No menu images provided for upload. Skipping temporary image upload stage.");
            }

            const originalNameToTempIdMap = new Map<string, string>();
            uploadedImagesMetadata.forEach(info => {
                originalNameToTempIdMap.set(info.originalName.toLowerCase(), info.tempId);
            });

            // --- STAGE 2: Prepare Final Bulk Payload from Parsed CSV Data ---
            const finalMenuPayload: FinalBulkMenuPayloadType = [];

            for (const csvItem of parsedCsvData) {
                const tempImageId = csvItem.originalImageFileNameCsv
                    ? originalNameToTempIdMap.get(csvItem.originalImageFileNameCsv.toLowerCase())
                    : undefined;

                if (csvItem.originalImageFileNameCsv && !tempImageId) {
                    // If CSV references an image name but it wasn't uploaded or matched
                    const errorMessage = `CSV references image "${csvItem.originalImageFileNameCsv}" for menu "${csvItem.name}" but this image was not among the successfully uploaded files or its name did not match.`;
                    setPageError(errorMessage); // Display error to user
                    throw new Error(errorMessage); // Throw to stop execution of this try block
                }

                finalMenuPayload.push({
                    name: csvItem.name,
                    price: csvItem.price,
                    maxDaily: csvItem.maxDaily,
                    cookingTime: csvItem.cookingTime,
                    isAvailable: csvItem.isAvailable,
                    imageFileName: tempImageId, // This is the temporary ID (UUID.ext) generated by backend
                    originalFileName: csvItem.originalImageFileNameCsv, // Original name from CSV, for backend reference if needed
                });
            }

            console.log(`Prepared ${finalMenuPayload.length} menu items for final bulk submission.`);

            // --- STAGE 3: Submit Final Bulk Payload to Backend (as JSON) ---
            // This assumes your backend /menu/bulk endpoint now accepts a JSON body.
            const { data: BulkCreateMenuResult } = await api.post<BulkCreateMenuResult>('/menu/bulk', { // Add leading slash for clarity
                restaurantId: restaurantId, // Ensure restaurantId is available in this component's scope
                createMenuDto: finalMenuPayload, // This property name should match your backend DTO
            });

            const successfullyCreatedMenus = BulkCreateMenuResult.createdMenus;
            setMenuLists((prev) => [...prev, ...successfullyCreatedMenus]); // Update your local menu list
            setSuccessMessage(`Successfully created ${BulkCreateMenuResult.totalCreated} menus!`);
            alert('Bulk menus created successfully!'); // Provide immediate user feedback

            // --- STAGE 4: Reset Form State and UI for Next Submission ---
            reset(); // Resets react-hook-form
            setMenuImagePreviewUrls([]); // Clear image previews
            setUploadedImageMetadata([]); // Clear uploaded image metadata
            setCsvFileName(null); // Clear CSV filename display
            setParsedCsvData(null); // Clear parsed CSV data
            setCsvParseError(null); // Clear any CSV parsing errors

        } catch (err: any) {
            console.error("Bulk upload processing failed:", err);
            // Display a user-friendly error message
            setPageError(err.response?.data?.message || err.message || "An unexpected error occurred during bulk menu upload.");
        } finally {
            setLoading(false); // End loading state
            console.log('Form submission process completed.');
        }
    };

    console.log('Update img metadata: ', uploadedImageMetadata);
    // Handler for generating CSV template (remains largely the same)
    const handleGenerateCsvTemplate = useCallback(() => {
        if (uploadedImageMetadata.length === 0) {
            alert("Please upload images first to generate the CSV template.");
            return;
        }

        // Headers should match csvMenuItemSchema field names, especially 'originalImageFileNameCsv'
        const headers = [
            "name", "description", "price", "maxDaily", "cookingTime", "isAvailable", "originalImageFileNameCsv"
        ];

        const csvRows = [
            headers.map(h => `"${h}"`).join(','), // Quote headers to handle potential spaces/special chars
            ...uploadedImageMetadata.map((info) => {
                const rowData = {
                    name: "Menu Item Name", price: "0", maxDaily: "100", cookingTime: "5", isAvailable: "true", // Default empty
                    originalImageFileNameCsv: info.originalName // Crucial: put original name here
                };
                // Order according to headers
                return headers.map(header => {
                    const value = rowData[header as keyof typeof rowData];
                    // Basic CSV escaping: quote if contains comma, newline, or double quote
                    if (typeof value === 'string' && (value.includes(',') || value.includes('\n') || value.includes('"'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                }).join(',');
            })
        ];

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        saveAs(blob, 'menu_bulk_template.csv');
        setSuccessMessage('CSV template downloaded successfully. Please fill it out');
    }, [uploadedImageMetadata]);


    // Determine if the final submit button should be disabled
    const isFinalSubmitDisabled = useMemo(() => {
        return loading || !parsedCsvData || parsedCsvData.length === 0 || uploadedImageMetadata.length === 0 || Object.keys(errors).length > 0;
    }, [loading, parsedCsvData, uploadedImageMetadata, errors]);

    const getRHFErrorMessage = (
        error: FieldError | Merge<FieldError, FieldErrorsImpl<any>> | undefined
    ): string | undefined => {
        if (!error) {
            return undefined;
        }
        // If it's a simple FieldError object with a message
        if (typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
            return error.message;
        }
        // If it's a string (though less common for top-level field errors)
        if (typeof error === 'string') {
            return error;
        }
        // Handle specific cases if Merge or FieldErrorsImpl needs deeper access,
        // e.g., if you have nested structures like errors.someField.root.message
        // For most single-field errors, the above 'message' check is sufficient.
        // This part might need adjustment if your Zod schema has very complex nested structures
        // that return errors in a non-standard way.
        // As a fallback, stringify if it's an object and has no direct 'message' property
        if (typeof error === 'object' && Object.keys(error).length > 0) {
            // This is a last resort to display something, might not be user-friendly
            // console.warn("RHF error object without a 'message' property:", error);
            // return JSON.stringify(error); // Consider if you want to show stringified object
        }
        return undefined;
    };

    console.log('Form error: ', errors);

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-8">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Bulk Add Menu Items</h1>

            {pageError && <p className="text-red-600 font-medium text-center">{pageError}</p>}
            {successMessage && <p className="text-green-600 font-medium text-center">{successMessage}</p>}
            {isSubmitting && <p className="text-blue-600 font-medium text-center">Submitting form...</p>}


            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                {/* --- Step 1: Upload Images --- */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-blue-200">
                    <h2 className="text-2xl font-semibold mb-4 text-blue-700">Step 1: Upload Menu Images</h2>
                    <p className="text-gray-700 mb-4">
                        Select all your menu image files (PNG, JPEG, WebP, max 5MB each). These images will be linked to your menu items in the CSV.
                    </p>
                    <label htmlFor="nativeMenuImgs" className="block text-lg font-semibold mb-2">
                        Upload Menu Images (Native Input)
                    </label>
                    <input
                        type="file"
                        id="nativeMenuImgs"
                        accept="image/png, image/jpeg, image/webp"
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
                            {menuImagePreviewUrls.map((url, index) => (
                                <div key={index} className="relative aspect-video w-full">
                                    <Image
                                        src={url}
                                        alt={`Menu Image Preview ${index + 1}`}
                                        fill // Use fill for responsive images
                                        className="object-contain rounded-lg border border-gray-200"
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
                        Generate CSV Template
                    </Button>
                    <p className="text-sm text-gray-500 mt-2 text-center">
                        (The template will pre-fill the `originalImageFileNameCsv` column based on your uploaded images.)
                    </p>
                </div>

                {/* --- Step 2: Upload Filled CSV --- */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-green-200">
                    <h2 className="text-2xl font-semibold mb-4 text-green-700">Step 2: Upload Filled CSV</h2>
                    <p className="text-gray-700 mb-4">
                        Download, fill, and then upload the CSV template here. Ensure menu names in the CSV match exactly any image filenames if you plan to link them.
                    </p>

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
                            <h3 className="font-semibold mb-1">CSV Parsing Errors:</h3>
                            <p>{csvParseError}</p>
                        </div>
                    )}

                    {parsedCsvData && parsedCsvData.length > 0 && !csvParseError && (
                        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-md text-sm">
                            Successfully parsed {parsedCsvData.length} rows from CSV.
                            <details className="mt-2">
                                <summary className="cursor-pointer text-blue-600 hover:underline font-medium">View Parsed Data (First 5 rows)</summary>
                                <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto max-h-40">
                                    {JSON.stringify(parsedCsvData.slice(0, 5), null, 2)}
                                    {parsedCsvData.length > 5 && "\n... (truncated)"}
                                </pre>
                            </details>
                        </div>
                    )}
                </div>

                {/* --- Final Submission Button --- */}
                <Button
                    type="submit" // This button now triggers RHF's handleSubmit, which then calls your onSubmit
                    disabled={isFinalSubmitDisabled}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg"
                >
                    {isSubmitting ? 'Processing Bulk Upload...' : 'Submit Bulk Menu Data'}
                </Button>
            </form>

            {/* --- Optional: Display Recently Added Menus --- */}
            {menuList.length > 0 && (
                <div className="mt-8">
                    <h2 className="text-2xl font-bold mb-4">Successfully Added Menus</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Assuming your <Menu> component exists and displays `ServerMenuItem` */}
                        {menuList.map((menu) => (
                            <Menu
                                key={menu.menuId}
                                menuId={menu.menuId}
                                name={menu.name}
                                price={menu.price}
                                isAvailable={menu.isAvailable}
                                maxDaily={menu.maxDaily}
                                menuImg={menuImagePreviewUrls.toString()} // Use the final image URL/path if available
                                cookingTime={menu.cookingTime}
                                createdAt={menu.createdAt}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}