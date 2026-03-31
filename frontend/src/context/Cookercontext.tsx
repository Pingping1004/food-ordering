"use client";

import { useEffect, createContext, useContext, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import type { Restaurant } from '@/app/data/type';
import { useParams } from 'next/navigation';

export interface Cooker extends Restaurant {
    email: string;
    adminName: string;
    adminSurname: string;
    adminTel: string;
    adminEmail: string;
    paymentQr: string
    openTime: string;
    closeTime: string;
    isTemporarilyClosed: boolean;
    isApproved: boolean;
};

export interface CookerContextType {
    cooker: Cooker;
    setCooker: React.Dispatch<React.SetStateAction<Cooker | undefined>>;
    loading: boolean;
    error: string | null;
}

export const CookerContext = createContext<CookerContextType | undefined>(undefined);

export const useCooker = () => {
    const context = useContext(CookerContext);
    if (!context) throw new Error('useCooker has no context');
    return context;
};

export const CookerProvider = ({ children }: { children: React.ReactNode }) => {
    const [cooker, setCooker] = useState<Cooker | undefined>(undefined);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    
    const params = useParams();
    const restaurantId = params.restaurantId;

    useEffect(() => {
        if (!restaurantId) return;

        const fetchCookerData = async () => {
            try {
                const cookerResponse = await api.get(`restaurant/${restaurantId}`);
                setCooker(cookerResponse.data);
            } catch {
                setError('โหลดข้อมูลร้านอาหารล้มเหลว');
            } finally {
                setLoading(false);
            }
        }
        fetchCookerData();
    }, [restaurantId]);

    const contextValue = useMemo(() => ({
        cooker: cooker!, setCooker, loading, error
    }), [cooker, setCooker, loading, error]);

    return (
        <CookerContext.Provider
            value={contextValue}
        >
            {children}
        </CookerContext.Provider>
    )
}