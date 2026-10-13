"use client";

import { toast, Toaster } from "sonner";

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
    fontFamily: "Noto Sans Thai, sans-serif",
    fontWeight: 400,
}

export const toastPrimary = (message: string) => {
    toast(message, {
        style: {
            background: '#E0E8F6',
            color: '#006CFE',
            ...baseStyle
        }
    })
};

export const toastDanger = (message: string) => {
    toast(message, {
        style: {
            background: '#FFE1E0',
            color: '#FF3632',
            ...baseStyle
        }
    })
};

export const toastSuccess = (message: string) => {
    toast(message, {
        style: {
            background: '#E3F4E6',
            color: '#45B858',
            ...baseStyle
        }
    })
};