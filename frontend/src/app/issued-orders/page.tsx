"use client";

import React from "react";
import CookerHeader from "@/components/cookers/Header";
import { Order } from "@/components/cookers/Order";

export default function IssuedOrderPage() {

  return (
    <div className="flex flex-col gap-y-10 py-10 px-6">
      <CookerHeader />
      <main>
        <Order
          orderId="123456789"
          name="ข้าวผัดกุ้ง"
          price={150}
          restaurantName="SomChai Suchi"
          selected="default"
          variant="receive"
          issued="no"
          orderAt={new Date()}
          deliverAt={new Date()}
          isPaid={true}
          orderMenu={[
            { key: "ขนาด", value: "ใหญ่" },
            { key: "พิเศษ", value: "ไม่มี" },
          ]}
          details="ข้าวผัดกุ้งรสเด็ด"
          className="mb-4"
        />
      </main>
    </div>
  );
}
