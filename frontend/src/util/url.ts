"use client";
import React, { useCallback } from 'react';

const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
export function getFullImageUrl(relativePath: string | undefined, baseUrl: string): string | null {
    // console.log("--- getFullImageUrl called ---"); // Debugging logs
    // console.log("  Input relativePath:", relativePath); // Debugging logs
    // console.log("  Using baseUrl parameter:", baseUrl); // Debugging logs

    if (!relativePath) {
        // console.log("  Result: null (no path provided)"); // Debugging logs
        return null;
    }

    // Scenario 1: Already an absolute URL (http://, https://) or a blob URL (for new uploads)
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://') || relativePath.startsWith('blob:')) {
        // console.log("  Result: Already absolute/blob. Returning as-is:", relativePath); // Debugging logs
        return relativePath;
    }

    // Scenario 2: It's a relative path from the backend (e.g., 'uploads/menus/...' or '/uploads/menus/...')
    if (!baseUrl) {
        console.error("ERROR: baseUrl is undefined or empty! Cannot construct full URL.");
        return null;
    }

    // Normalize the base URL: ensure it *doesn't* end with a slash for concatenation
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    // Normalize the relative path: ensure it *starts* with a slash
    const normalizedRelativePath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;

    // Now, combine them with exactly one slash in between
    const fullUrl = `${normalizedBaseUrl}${normalizedRelativePath}`;
    // console.log("  Result: Constructed full URL:", fullUrl); // Debugging logs
    return fullUrl;
}