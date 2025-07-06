import React from 'react'
import Image from 'next/image'
import { format } from 'date-fns'
import { CartItem } from '@/context/CartContext';
import { Input } from '../Input';
import { useCart } from '@/context/CartContext';
import { Button } from '../Button';

export interface OrderType {
  orderId: string
  status: 'receive' | 'cooking' | 'ready' | 'done';
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
  totalPrice: number;
}

interface CartListProps {
  items: CartItem[];
}

export default function OrderList({ items }: CartListProps) {
  const { addToCart, removeFromCart } = useCart();

  return (
    <div>
      {items.map((menu, index) => {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const src = menu.menuImg ? `${baseUrl}${menu.menuImg}` : '/picture.svg';

        return (
          <div
            key={index}
            className="flex w-[calc(100%+3rem)] border-y border-color -mx-6"
          >
            <div className="flex w-full justify-between gap-x-4 py-4 px-6">
              <div className="relative w-[74px] h-[74px] aspect-square">
                <Image
                  width={74}
                  height={74}
                  src={src}
                  alt={menu.menuName}
                  className="rounded-lg object-cover w-full h-full"
                />
              </div>

              <div className="flex flex-col w-full justify-between">
                <div className="flex justify-between">

                  <div className="w-full">
                    <h4 className="text-primary noto-sans-bold text-sm">{menu.menuName}</h4>
                    <p className="text-light text-xs noto-sans-regular">{menu.unitPrice} บาท</p>
                  </div>

                  <div className="flex items-center gap-x-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondarySuccess"
                      onClick={() => removeFromCart(menu.menuId)}
                    >
                      -
                    </Button>
                    <p>{menu.quantity}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="success"
                      onClick={() => addToCart(menu.menuId, menu.menuName, menu.unitPrice, menu.menuImg, menu.restaurantId)}
                    >
                      +
                    </Button>
                  </div>

                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  )
}
