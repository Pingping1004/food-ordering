"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

export interface Menu {
    menuId: string;
    name: string;
    menuImg: string;
    sellPriceDisplay: number;
    price: number;
    maxDaily: number;
    cookingTime: number;
    isAvailable: boolean;
    isOrderable: boolean;
    restaurantId: string;
}

type MenuContextType = {
    menus: Menu[] | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;

    updateMenu: (menuId: string, updater: (menu: Menu) => Menu) => void;
    deleteMenuLocal: (menuId: string) => void;
};

const MenuContext = createContext<MenuContextType | null>(null);

export const useMenu = () => {
    const ctx = useContext(MenuContext);
    if (!ctx) throw new Error("useMenu must be used within MenuProvider");
    return ctx;
};

export const MenuProvider = ({ children }: { children: React.ReactNode }) => {
    const params = useParams();
    const restaurantId = params.restaurantId as string;

    const [menus, setMenus] = useState<Menu[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchMenus = useCallback(async () => {
        if (!restaurantId) return;

        try {
            setLoading(true);
            const res = await api.get(`menu/${restaurantId}`);
            setMenus(res.data);
            setError(null);
        } catch {
            setError("Failed to fetch menus");
        } finally {
            setLoading(false);
        }
    }, [restaurantId]);

    const updateMenu = useCallback((menuId: string, updater: (menu: Menu) => Menu) => {
        setMenus(prev =>
            prev?.map(menu =>
                menu.menuId === menuId ? updater(menu) : menu
            ) || null
        );
    }, []);

    const deleteMenuLocal = useCallback((menuId: string) => {
        setMenus(prev => prev?.filter(menu => menu.menuId !== menuId) || null);
    }, []);

    useEffect(() => {
        fetchMenus();
    }, [fetchMenus]);

    const value = useMemo(() => ({
        menus, loading, error, refetch: fetchMenus, updateMenu, deleteMenuLocal
    }), [menus, loading, error, fetchMenus, deleteMenuLocal, updateMenu]);

    return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
};