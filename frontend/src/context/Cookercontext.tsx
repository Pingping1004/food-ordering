"use client";

import React, { useEffect, createContext, useContext, useState, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { Restaurant } from './MenuContext';
import { useParams } from 'next/navigation';
import { OrderProps } from '@/components/cookers/Order';
import LoadingPage from '@/components/LoadingPage';

export interface Cooker extends Restaurant {
    email: string;
    adminName: string;
    adminSurname: string;
    adminTel: string;
    adminEmail: string;
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

    if (loading) return <LoadingPage />
    if (error) return <div>{error}</div>;
    if (!cooker) return <div>ไม่พบร้านอาหาร</div>

    return (
        <CookerContext.Provider
            value={contextValue}
        >
            {children}
        </CookerContext.Provider>
    )
}