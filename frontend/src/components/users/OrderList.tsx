import React from 'react'
import { CartItem, useCart } from '@/context/CartContext';
import type { OrderStatus } from '../cookers/OrderNavbar';

export interface OrderType {
  orderId: string
  status: OrderStatus;
  details?: string;
  isPaid: 'paid' | 'unpaid' | 'processing' | 'rejected';
  isDelay: boolean;
  refCode?: string;
  orderAt: string;
  deliverAt: string;
  orderMenus: OrderMenuType[];
}

export interface OrderMenuType {
  quantity: number;
  menuName: string;
  menuImg: string;
  unitPrice: number;
}

interface CartListProps {
  items: CartItem[];
}

export default function OrderList({ items }: Readonly<CartListProps>) {
    const { addToCart, removeFromCart } = useCart();

    return (
        <div className="flex flex-col gap-3.5">
            {items.map((menu) => (
                <div key={menu.menuId} className="flex items-center gap-3 border-t border-[#EEF1F6] pt-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <h4 className="font-app text-base font-semibold">{menu.menuName}</h4>
                        <p className="font-app text-sm text-brand-muted">{menu.unitPrice} บาท / จาน</p>
                    </div>
                    <div className="flex items-center rounded-xl border border-line">
                        <button type="button" aria-label={`ลดจำนวน ${menu.menuName}`} onClick={() => removeFromCart(menu.menuId)}
                            className="h-11 w-11 text-xl">−</button>
                        <span className="min-w-[22px] text-center text-base font-bold">{menu.quantity}</span>
                        <button type="button" aria-label={`เพิ่มจำนวน ${menu.menuName}`}
                            onClick={() => addToCart(menu.menuId, menu.menuName, menu.unitPrice, menu.menuImg, menu.isAvailable, menu.restaurantId)}
                            className="h-11 w-11 text-xl">+</button>
                    </div>
                    <span className="w-16 text-right text-base font-bold">{menu.unitPrice * menu.quantity}</span>
                </div>
            ))}
        </div>
    )
}
