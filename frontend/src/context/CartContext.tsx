"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface CartItem {
    menuId: string;
    menuName: string;
    unitPrice: number;
    menuImg: string;
    quantity: number;
    restaurantId: string;
};

type CartContextType = {
    cart: CartItem[];
    addToCart: (menuId: string, menuName: string, unitPrice: number, menuImg: string, restaurantId: string) => void;
    removeFromCart: (menuId: string) => void;
    getQuantity: (menuId: string) => number;
    clearCart: () => void;
};

const CartContext = createContext<CartContextType | null>(null);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
    const [cart, setCart] = useState<CartItem[]>(() => {
        if (typeof window === "undefined") return [];

        try {
            const stored = localStorage.getItem("cart");
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        localStorage.setItem("cart", JSON.stringify(cart));
    }, [cart]);

    const addToCart = useCallback((menuId: string, menuName: string, unitPrice: number, menuImg: string, restaurantId: string) => {
        let rejected = false;

        setCart((prev) => {
            if (prev.length > 0 && prev[0].restaurantId !== restaurantId) {
                rejected = true
                return prev;
            }

            const existingCartItem = prev.find((item) => item.menuId === menuId);

            if (existingCartItem) {
                return prev.map((item) =>
                    item.menuId === menuId
                        ? {
                            ...item,
                            quantity: item.quantity + 1
                        }
                        : item);
            }

            return [
                ...prev,
                { menuId, menuName, unitPrice, menuImg, quantity: 1, restaurantId }
            ];
        });

        if (rejected) return { success: false, reason: "คนละร้านอาหาร" };

        return { success: true }
    }, []);

    const removeFromCart = useCallback((menuId: string) => {
        setCart((prev) => {
            const existingCartItem = prev.find((item) => item.menuId === menuId);
            if (!existingCartItem) return prev;

            if (existingCartItem.quantity > 1) {
                return prev.map((item) =>
                    item.menuId === menuId
                        ? {
                            ...item,
                            quantity: item.quantity - 1,
                        }
                        : item
                );
            } else {
                return prev.filter((item) => item.menuId !== menuId);
            }
        });
    }, []);

    const clearCart = useCallback(() => {
        setCart([]);
    }, []);

    const getQuantity = useCallback((menuId: string) => {
        const item = cart.find(item => menuId === item.menuId);
        return item ? item.quantity : 0;
    }, [cart]);

    const contextValue = useMemo(() => ({
        cart, addToCart, removeFromCart, getQuantity, clearCart
    }), [cart, addToCart, removeFromCart, getQuantity, clearCart]);

    return (
        <CartContext.Provider
            value={contextValue}
        >
            {children}
        </CartContext.Provider>
    );
}

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) throw new Error('useCart must be used within a CartProvider');
    return context;
}