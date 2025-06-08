import React from 'react'
import CookerHeader from '@/components/cookers/Header'
import { Button } from '@/components/Button'
import { Menu } from '@/components/cookers/Menu'

export default function ManageMenuPage() {
  
  return (
    <div className="flex flex-col gap-y-10 py-10 px-6">
      <CookerHeader />

      <Button
        size="full"
      >
        <p>เพิ่มรายการอาหาร</p>
      </Button>

      <h2 className="noto-sans-bold text-lg">จัดการเมนู</h2>
      <Menu 
        menuId="menu-1"
        name="ข้าวผัดกุ้ง"
        price={150}
        restaurantName="SomChai Suchi"
        createdAt={new Date()}
        isAvailable={true}
      />

    </div>
  )
}
