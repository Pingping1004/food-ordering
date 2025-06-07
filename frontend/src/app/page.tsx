"use client";

import { Button } from "@/components/Button";
import CookerHeader from "@/components/cookers/Header";
import { Order } from "@/components/cookers/Order";
import { OrderNavBar } from "@/components/cookers/OrderNavbar";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CookerHomePage() {
  const router = useRouter();
  const [isUpdateMode, setIsUpdateMode] = useState(false); // State to toggle update mode
  const [selectedCount, setSelectedCount] = useState(0); // State to track selected orders

  const handleUpdateClick = () => {
    setIsUpdateMode(true); // Enable update mode
    setSelectedCount(2); // Example: Set the count of selected orders (replace with actual logic)
  };

  const handleCompleteClick = () => {
    setIsUpdateMode(false); // Exit update mode
    setSelectedCount(0); // Reset selected count
  };

  return (
    <div className="flex flex-col gap-y-10 py-10 px-6">
      <CookerHeader />
      <OrderNavBar onClick={() => router.push("/")} />
      {!isUpdateMode ? (
        <section className="grid grid-cols-2 gap-4">
          <Button
            variant="danger"
            size="md"
            className="flex items-center justify-between"
            iconPosition="start"
            numberIcon={2}
            onClick={() => router.push("/issued-orders")}
          >
            ออเดอร์ที่มีปัญหา
          </Button>

          <Button
            variant="secondary"
            size="md"
            className="flex items-center justify-between"
            onClick={handleUpdateClick} // Trigger update mode
          >
            อัพเดทหลายออเดอร์
          </Button>
        </section>
      ) : (
        <Button
          variant="primary"
          size="full"
          className="flex items-center justify-center"
          onClick={handleCompleteClick} // Complete update mode
        >
          <div className="flex gap-x-2 noto-sans-bold text-sm">
            <span>({selectedCount})</span>
            <span>อัพเดทสถานะออเดอร์</span>
          </div>
        </Button>
      )}
      <main>
        <Order
          orderId="123456789"
          name="ข้าวผัดกุ้ง"
          price={150}
          restaurantName="SomChai Suchi"
          selected="default"
          issued="no"
          variant="receive"
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
