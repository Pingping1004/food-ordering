// "use client";

// import React from "react";
// import CookerHeader from "@/components/cookers/Header";
// import { Order } from "@/components/cookers/Order";
// import { IssuedOrderNavbar } from "@/components/cookers/IssuedNavbar";

// export default function IssuedOrderPage() {

//   return (
//     <div className="flex flex-col gap-y-10 py-10 px-6">
//       <CookerHeader 
//         restaurantId={}
//       />
//       <IssuedOrderNavbar />
//       <h3 className="noto-sans-bold text-base">ออเดอร์ที่มีปัญหา</h3>
//       <main>
//         <Order
//           orderId="123456789"
//           name="ข้าวผัดกุ้ง"
//           price={150}
//           restaurantName="SomChai Suchi"
//           selected="default"
//           variant="receive"
//           issued="no"
//           orderAt={new Date()}
//           deliverAt={new Date()}
//           isPaid={true}
//           orderMenu={[
//             { units: 1, value: "ข้าวผัดกุ้ง" },
//             { units: 1, value: "ข้าวผัดกุ้ง" },
//           ]}
//           details="ขอรสเผ็ดๆ แซ่บๆ"
//           className="mb-4"
//         />
//       </main>
//     </div>
//   );
// }
