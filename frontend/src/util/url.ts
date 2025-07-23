"use client";

export function getFullImageUrl(relativePath: string | undefined, baseUrl: string): string | null {
    if (!relativePath) {
        return null;
    }

    // Scenario 1: Already an absolute URL (http://, https://) or a blob URL (for new uploads)
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://') || relativePath.startsWith('blob:')) {
        return relativePath;
    }

    if (!baseUrl) return null;

    // Normalize the base URL: ensure it *doesn't* end with a slash for concatenation
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    // Normalize the relative path: ensure it *starts* with a slash
    const normalizedRelativePath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;

    const fullUrl = `${normalizedBaseUrl}${normalizedRelativePath}`;
    return fullUrl;
}