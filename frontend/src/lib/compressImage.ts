/**
 * Shrinks a phone photo before upload (3-8 MB -> roughly 100-200 KB).
 * Output is always a .jpg because the backend filter only accepts lowercase extensions.
 */
export async function compressImage(
    file: File,
    maxSide = 800,
    quality = 0.82,
): Promise<File> {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) throw new Error("image encode failed");

    const base = file.name.replace(/\.[^.]+$/, "") || "menu";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}
