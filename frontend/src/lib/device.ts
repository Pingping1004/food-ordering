export const isIOS = () => {
    if (typeof navigator === "undefined") return false;
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

export const isAndroid = () => {
    if (typeof navigator === "undefined") return false;
    return /Android/i.test(navigator.userAgent);
};