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
    orders: OrderProps[];
    setCooker: React.Dispatch<React.SetStateAction<Cooker | undefined>>;
    setOrders: React.Dispatch<React.SetStateAction<OrderProps[]>>;
    fetchOrders: () => void;
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
    const [orders, setOrders] = useState<OrderProps[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const params = useParams();
    const restaurantId = params.restaurantId;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const cookerResponse = await api.get(`restaurant/${restaurantId}`);
                setCooker(cookerResponse.data);

                const orderResponse = await api.get(`order/get-orders/${restaurantId}`);
                setOrders(orderResponse.data);
            } catch {
                setError('Error fetching cooker context');
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [restaurantId]);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const orderResponse = await api.get(`order/get-orders/${restaurantId}`);
            setOrders(orderResponse.data);
        } catch {
            setError('Failed to load orders.');
        } finally {
            setLoading(false);
        }
    }, [restaurantId]);

    const contextValue = useMemo(() => ({
        cooker: cooker!, setCooker, orders, setOrders, fetchOrders, loading, error
    }), [cooker, setCooker, orders, setOrders, fetchOrders, loading, error]);

    if (loading) return <LoadingPage />
    if (error) return <div>{error}</div>;
    if (!cooker) return <div>No Cooker found</div>

    return (
        <CookerContext.Provider
            value={contextValue}
        >
            {children}
        </CookerContext.Provider>
    )
}