"use client";

import React, { useEffect, createContext, useContext, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { RestaurantCategory } from '@/components/users/RestaurantProfile';
import { Restaurant } from './MenuContext';
import { useParams } from 'next/navigation';
import { OrderProps } from '@/components/cookers/Order';

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
    const [cooker, setCooker] = useState<Cooker>();
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
                console.log('Cooker context: ', cookerResponse.data);

                const orderResponse = await api.get(`order/get-orders/${restaurantId}`);
                setOrders(orderResponse.data);
                console.log('Order context: ', orderResponse.data);
            } catch (error) {
                setError('Error fetching cooker context');
                console.error(error);
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
        } catch (error) {
            console.error('Failed to fetch all orders:', error);
            setError('Failed to load orders.');
        } finally {
            setLoading(false);
        }
    }, [])

    if (loading) return <div>Loading...</div>;
    if (error) return <div>{error}</div>;
    if (!cooker) return <div>No Cooker found</div>

    return (
        <CookerContext.Provider
            value={{
                cooker,
                setCooker,
                orders,
                setOrders,
                fetchOrders,
                loading,
                error,
            }}
        >
            {children}
        </CookerContext.Provider>
    )
}