"use client";

import { toast, Toaster } from "sonner";
import { errorReason } from "@/lib/error-reason";

export function AppToaster() {
    return (
      <Toaster
        richColors
        position="top-center"
      />
    )
  }

const baseStyle = {
    fontSize: "16px",
    fontFamily: "var(--font-kanit), system-ui, sans-serif",
    fontWeight: 400,
}

/** Same text twice (e.g. an effect firing twice) updates the toast already on screen instead of stacking another. */
const toastId = (message: string, reason?: string) => `${message}|${reason ?? ""}`;

export const toastPrimary = (message: string) => {
    toast(message, {
        id: toastId(message),
        style: {
            background: '#E0E8F6',
            color: '#006CFE',
            ...baseStyle
        }
    })
};

/** `reason` = one short plain-language line saying why it failed / what to do (shown under the message). */
export const toastDanger = (message: string, reason?: string) => {
    toast(message, {
        id: toastId(message, reason),
        description: reason,
        style: {
            background: '#FFE1E0',
            color: '#FF3632',
            ...baseStyle
        }
    })
};

export const toastSuccess = (message: string) => {
    toast(message, {
        id: toastId(message),
        style: {
            background: '#E3F4E6',
            color: '#45B858',
            ...baseStyle
        }
    })
};

/** Error toast for a failed request: `message` says what failed, the reason line is derived from `err`. */
export const toastError = (message: string, err?: unknown) => toastDanger(message, errorReason(err));
