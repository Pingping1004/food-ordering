"use client";

import React from 'react'
import CookerHeader from '@/components/cookers/Header'
import { Button } from '@/components/Button'
import { Menu } from '@/components/cookers/Menu'
import { CookerProvider, useCooker } from '@/context/Cookercontext'

function Page() {
  const { cooker } = useCooker();
  
  return (
    <div className="flex flex-col gap-y-10 py-10 px-6">
      <CookerHeader 
        restaurantId={cooker.restaurantId}
        name={cooker.name}
        email={cooker.email}
        openTime={cooker.openTime}
        closeTime={cooker.closeTime} 
      />

      <Button
        type="button"
        size="full"
      >
        <p>เพิ่มรายการอาหาร</p>
      </Button>

      <h2 className="noto-sans-bold text-lg">จัดการเมนู</h2>
      <Menu 
        menuId="menu-1"
        name="ข้าวผัดกุ้ง"
        price={150}
        maxDaily={100}
        cookingTime={5}
        restaurantName="SomChai Suchi"
        createdAt={new Date()}
        isAvailable={true}
      />

    </div>
  )
}

export default function ManageMenuPage() {
  return (
    <CookerProvider>
      <Page />
    </CookerProvider>
  )
}
