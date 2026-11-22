"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toastDanger } from "@/components/ui/Toast";
import { TOO_MANY_DISHES_MESSAGE, canAddDish, totalDishes } from "@/lib/order-limits";

export interface CartItem {
    menuId: string;
    menuName: string;
    unitPrice: number;
    menuImg: string;
    isAvailable: boolean;
    quantity: number;
    restaurantId: string;
};

type AddResult = { success: true } | { success: false; reason: string };

type CartContextType = {
    cart: CartItem[];
    addToCart: (menuId: string, menuName: string, unitPrice: number, menuImg: string, isAvailable: boolean, restaurantId: string) => AddResult;
    /** Dishes in the cart, counted by quantity. */
    dishCount: number;
    /** False once the cart holds MAX_DISHES_PER_ORDER dishes. */
    canAddMore: boolean;
    removeFromCart: (menuId: string) => void;
    getQuantity: (menuId: string) => number;
    clearCart: () => void;
    hydrated: boolean;
};

const CartContext = createContext<CartContextType | null>(null);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
    const [cart, setCart] = useState<CartItem[]>([]);
    const [hydrated, setHydrated] = useState(false);
    const cartRef = useRef(cart);

    useEffect(() => {
        try {
            const stored = localStorage.getItem("cart");
            if (stored) setCart(JSON.parse(stored));
        } finally {
            setHydrated(true);
        }
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        localStorage.setItem("cart", JSON.stringify(cart));
    }, [cart, hydrated]);

    useEffect(() => { cartRef.current = cart }, [cart]);

    const addToCart = useCallback((menuId: string, menuName: string, unitPrice: number, menuImg: string, isAvailable: boolean, restaurantId: string): AddResult => {
        const current = cartRef.current;
        if (current.length > 0 && current[0].restaurantId !== restaurantId) {
            return { success: false, reason: "คนละร้านอาหาร" };
        }

        if (!isAvailable) return { success: false, reason: "เมนูนี้ไม่พร้อมให้บริการ" }

        if (!canAddDish(current)) {
            toastDanger(TOO_MANY_DISHES_MESSAGE, "ลดจำนวนเมนูอื่นก่อน หรือแยกเป็นอีกออเดอร์");
            return { success: false, reason: TOO_MANY_DISHES_MESSAGE };
        }

        setCart((prev) => {
            // Taps faster than a render: re-check against the latest state.
            if (!canAddDish(prev)) return prev;
            const existingCartItem = prev.find((item) => item.menuId === menuId);

            if (existingCartItem) {
                return prev.map((item) =>
                    item.menuId === menuId
                        ? { ...item, quantity: item.quantity + 1 }
                        : item);
            }

            return [...prev, { menuId, menuName, unitPrice, menuImg, isAvailable, quantity: 1, restaurantId }];
        });

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

    const dishCount = totalDishes(cart);
    const canAddMore = canAddDish(cart);

    const contextValue = useMemo(() => ({
        cart, addToCart, removeFromCart, getQuantity, clearCart, hydrated, dishCount, canAddMore
    }), [cart, addToCart, removeFromCart, getQuantity, clearCart, hydrated, dishCount, canAddMore]);

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