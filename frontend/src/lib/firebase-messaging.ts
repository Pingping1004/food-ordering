"use client";

import { api } from "@/lib/api";
import axios from "axios";
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
    getMessaging,
    getToken,
    isSupported,
    onMessage,
    type MessagePayload,
    type Messaging,
} from "firebase/messaging";

const TOKEN_STORAGE_KEY = "promptserve:cooker_push_token";
const MAX_PUSH_REGISTRATION_ATTEMPTS = 3;
const PUSH_RETRY_DELAY_MS = 1500;

type PushRegistrationResult =
    | { status: "registered"; token: string; attempts: number }
    | { status: "permission-default" | "permission-denied" | "unsupported" | "missing-config" | "missing-token" | "registration-failed"; errorMessage: string; errorCode?: string | number; attempts: number };

let messagingInstance: Messaging | null = null;

function getFirebaseConfig() {
    return {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
}

function hasFirebaseConfig() {
    const config = getFirebaseConfig();
    return Object.values(config).every(Boolean) && Boolean(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY);
}

function getMissingConfigKeys() {
    const config = {
        NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        NEXT_PUBLIC_FIREBASE_VAPID_KEY: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    };

    return Object.entries(config)
        .filter(([, value]) => !value)
        .map(([key]) => key);
}

function getFirebaseApp(): FirebaseApp | null {
    if (!hasFirebaseConfig()) return null;

    const existing = getApps()[0];
    if (existing) return existing;

    return initializeApp(getFirebaseConfig());
}

async function getMessagingInstance() {
    if (messagingInstance) return messagingInstance;

    const supported = await isSupported().catch(() => false);
    if (!supported) return null;

    const app = getFirebaseApp();
    if (!app) return null;

    messagingInstance = getMessaging(app);
    return messagingInstance;
}

function delay(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizeRegistrationError(error: unknown) {
    if (axios.isAxiosError(error)) {
        const backendMessage =
            typeof error.response?.data?.message === "string"
                ? error.response.data.message
                : Array.isArray(error.response?.data?.message)
                    ? error.response?.data?.message.join(", ")
                    : error.message;

        return {
            errorCode: error.code ?? `http_${error.response?.status ?? "unknown"}`,
            errorMessage: backendMessage || "ถูกปฏิเสธโดยระบบ",
        };
    }

    if (typeof error === "object" && error !== null && "code" in error) {
        const typedError = error as { code?: string | number; name?: string; message?: string };
        return {
            errorCode: typedError.code ?? typedError.name,
            errorMessage: typedError.message ?? "การตั้งค่าล้มเหลว",
        };
    }

    if (error instanceof Error) {
        return {
            errorCode: "unknown_error",
            errorMessage: error.message,
        };
    }

    return {
        errorCode: "unknown_error",
        errorMessage: "เกิดข้อผิดพลาดไม่ทราบสาเหตุ",
    };
}

export async function registerNotificationServiceWorker() {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;

    return navigator.serviceWorker.register("/sw.js", { scope: "/", type: 'module' });
}

export async function requestNotificationPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) {
        return "unsupported" as const;
    }

    return Notification.requestPermission();
}

export function getNotificationPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) {
        return "unsupported" as const;
    }

    return Notification.permission;
}

export function readStoredPushToken() {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export async function deactivateStoredPushToken() {
    const existingToken = readStoredPushToken();
    if (!existingToken) return;

    await api.delete("/notification/device-token", {
        data: { token: existingToken },
    }).catch(() => undefined);

    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export async function syncCookerPushToken(): Promise<PushRegistrationResult> {
    const permission = getNotificationPermission();
    if (permission !== "granted") {
        return {
            status: permission === "denied" ? "permission-denied" : "permission-default",
            errorMessage:
                permission === "denied"
                    ? "Browser notification permission is blocked."
                    : "Notification permission has not been granted yet.",
            attempts: 0,
        };
    }

    if (!hasFirebaseConfig()) {
        const missingKeys = getMissingConfigKeys();
        return {
            status: "missing-config",
            errorCode: "missing_config",
            errorMessage: `Missing frontend Firebase env vars: ${missingKeys.join(", ")}`,
            attempts: 0,
        };
    }

    const messaging = await getMessagingInstance();
    if (!messaging) {
        return {
            status: "unsupported",
            errorCode: "unsupported_browser",
            errorMessage: "This browser does not support Firebase web push messaging.",
            attempts: 0,
        };
    }

    const serviceWorkerRegistration = await registerNotificationServiceWorker();
    if (!serviceWorkerRegistration) {
        return {
            status: "unsupported",
            errorCode: "missing_service_worker",
            errorMessage: "Service workers are unavailable in this browser.",
            attempts: 0,
        };
    }

    try {
        const existingSub = await serviceWorkerRegistration.pushManager.getSubscription();
        if (existingSub) {
            await existingSub.unsubscribe();
        }
    } catch (error) {
        throw error
    }

    for (let attempt = 1; attempt <= MAX_PUSH_REGISTRATION_ATTEMPTS; attempt += 1) {
        try {
            const token = await getToken(messaging, {
                vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
                serviceWorkerRegistration,
            });

            if (!token) {
                return {
                    status: "missing-token",
                    errorCode: "empty_token",
                    errorMessage: "Firebase returned an empty device token.",
                    attempts: attempt,
                };
            }

            const previousToken = readStoredPushToken();
            if (previousToken && previousToken !== token) {
                await api.delete("/notification/device-token", {
                    data: { token: previousToken },
                }).catch(() => undefined);
            }

            await api.post("/notification/device-token", {
                token,
                platform: detectPlatform(),
                userAgent: window.navigator.userAgent,
            });

            window.localStorage.setItem(TOKEN_STORAGE_KEY, token);

            return {
                status: "registered",
                token,
                attempts: attempt,
            };
        } catch (error) {
            const normalized = normalizeRegistrationError(error);

            const shouldResetSubscription =
                normalized.errorCode === 20 ||
                normalized.errorCode === "20" ||
                normalized.errorCode === "AbortError" ||
                normalized.errorMessage.toLowerCase().includes("push service error");

            if (shouldResetSubscription) {
                await resetPushSubscription(serviceWorkerRegistration);
            }

            if (attempt === MAX_PUSH_REGISTRATION_ATTEMPTS) {
                return {
                    status: "registration-failed",
                    errorCode: normalized.errorCode,
                    errorMessage: normalized.errorMessage,
                    attempts: attempt,
                };
            }

            await delay(PUSH_RETRY_DELAY_MS * attempt);
        }
    }

    return {
        status: "registration-failed",
        errorCode: "retry_exhausted",
        errorMessage: "Push registration retries were exhausted.",
        attempts: MAX_PUSH_REGISTRATION_ATTEMPTS,
    };
}

async function resetPushSubscription(serviceWorkerRegistration: ServiceWorkerRegistration) {
    const subscription = await serviceWorkerRegistration.pushManager.getSubscription();
    if (subscription) {
        await subscription.unsubscribe().catch(() => undefined);
    }

    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}


export async function subscribeToForegroundMessages(
    callback: (payload: MessagePayload) => void,
) {
    const messaging = await getMessagingInstance();
    if (!messaging) {
        return () => undefined;
    }

    return onMessage(messaging, callback);
}

function detectPlatform() {
    if (typeof window === "undefined") return "unknown";

    const userAgent = window.navigator.userAgent.toLowerCase();
    if (userAgent.includes("iphone") || userAgent.includes("ipad")) return "ios";
    if (userAgent.includes("android")) return "android";
    return "web";
}
