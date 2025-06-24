"use client";
import React, { createContext, useContext, useState } from "react";

export type CartItem = {
    menuId: string;
    menuName: string;
    unitPrice: number;
    menuImg: string;
    quantity: number;
    totalPrice: number;
};

type CartContextType = {
    cart: CartItem[];
    addToCart: (menuId: string, menuName: string, unitPrice: number, menuImg: string) => void;
    removeFromCart: (menuId: string) => void;
    getQuantity: (menuId: string) => number;
};

const CartContext = createContext<CartContextType | null>(null);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
    const [cart, setCart] = useState<CartItem[]>([]);

    const addToCart = (menuId: string, menuName: string, unitPrice: number, menuImg: string) => {
        setCart((prev) => {
            const existingCartItem = prev.find((item) => item.menuId === menuId);
            let newCart;
    
            if (existingCartItem) {
                newCart = prev.map((item) => 
                    item.menuId === menuId
                    ? {
                        ...item, 
                        quantity: item.quantity + 1, 
                        totalPrice: item.unitPrice * (item.quantity + 1)
                        } 
                    : item);
            } else {
                // Assign default price as 0, modify as needed.
                newCart = [
                    ...prev,
                     { menuId, menuName, unitPrice, menuImg, quantity: 1, totalPrice: unitPrice }
                ];
            }

            return newCart;
        });
    };

    const removeFromCart = (menuId: string) => {
        setCart((prev) => {
            const existingCartItem = prev.find((item) => item.menuId === menuId);
            if (!existingCartItem) {
                console.error('Item does not exist to delete');
                return prev;
            }

            if (existingCartItem.quantity > 1) {
                return prev.map((item) => 
                    item.menuId === menuId
                        ? {
                            ...item,
                            quantity: item.quantity - 1,
                            totalPrice: item.unitPrice * (item.quantity - 1),
                        }
                        : item
                );
            } else {
                return prev.filter((item) => item.menuId === menuId);
            }
        });
    };

    const getQuantity = (menuId: string) => {
        const item = cart.find(item => menuId === item.menuId);
        return item ? item.quantity : 0;
    }

    return (
        <CartContext.Provider
            value={{ cart, addToCart, removeFromCart, getQuantity }}
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