import { toast } from "sonner";

export const toastPrimary = (message: string) => {
    toast(message, {
        style: {
            background: '#E0E8F6',
            color: '#006CFE',
            fontSize: '16px',
            fontFamily: 'Noto Sans Thai, sans-serif',
            fontWeight: 400,
        }
    })
};

export const toastDanger = (message: string) => {
    toast(message, {
        style: {
            background: '#FFE1E0',
            color: '#FF3632',
            fontSize: '16px',
            fontFamily: 'Noto Sans Thai, sans-serif',
            fontWeight: 400,
        }
    })
};

export const toastSuccess = (message: string) => {
    toast(message, {
        style: {
            background: '#E3F4E6',
            color: '#45B858',
            fontSize: '16px',
            fontFamily: 'Noto Sans Thai, sans-serif',
            fontWeight: 400,
        }
    })
};