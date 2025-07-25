"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { RestaurantCategory } from "@/components/users/RestaurantProfile";

export interface Restaurant {
    // [x: string]: any;
    restaurantId: string;
    name: string;
    image: string;
    restaurantImg: string;
    categories: RestaurantCategory[];
    openTime: string;
    closeTime: string;
    isOpen: boolean;
    isActuallyOpen: boolean;
    isTemporarilyClosed: boolean;
};

export interface Menu {
    menuId: string;
    name: string;
    menuImg?: string;
    sellPriceDisplay: number;
    price: number;
    maxDaily: number;
    cookingTime: number;
    isAvailable: boolean;
    restaurantId: string;
    createdAt: string;
}

export interface MenuContextType {
    restaurant: Omit<Restaurant, 'email'>;
    menus: Menu[] | null;
    setMenus: React.Dispatch<React.SetStateAction<Menu[] | null>>;
    loading: boolean;
    error: string | null;
}

export const MenuContext = createContext<MenuContextType | null>(null);

export const useMenu = () => {
    const context = useContext(MenuContext);
    
    if (!context) throw new Error("useMenuContext must be used within MenuProvider");
    return context;
};

export const MenuProvider = ({ children }: { children: React.ReactNode }) => {
    const params = useParams();
    const restaurantId = Array.isArray(params.restaurantId)
        ? params.restaurantId[0]
        : params.restaurantId;

    const [restaurant, setRestaurant] = useState<Restaurant>({
        restaurantId: '',
        name: '',
        image: '',
        restaurantImg: '',
        categories: [],
        openTime: '',
        closeTime: '',
        isOpen: true,
        isActuallyOpen: true,
        isTemporarilyClosed: false,
    });
    const [menus, setMenus] = useState<Menu[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const contextValue = useMemo(() => ({
        restaurant,
        menus,
        setMenus,
        loading,
        error,
    }), [restaurant, menus, setMenus, loading, error]);

    useEffect(() => {
        if (!restaurantId) return;
        const fetchData = async () => {
            try {
                const menuResponse = await api.get(`menu/${restaurantId}`);
                setMenus(menuResponse.data);

                const restaurantResponse = await api.get(`restaurant/${restaurantId}`);
                setRestaurant(restaurantResponse.data);
            } catch {
                setError('Error fetching menu context');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [restaurantId]);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>{error}</div>;
    if (!menus) return <div>No Data found</div>

    return (
        <MenuContext.Provider
            value={contextValue}
        >
            {children}
        </MenuContext.Provider>
    )
}