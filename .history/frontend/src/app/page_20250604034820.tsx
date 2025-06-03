import CookerHeader from "@/component/cookers/Header";

export default function CookerHomePage() {
  return (
    <div>
      <CookerHeader />
      <section className="grid grid-cols-2">
        <button className="bg-danger-main text-white">ออเดอร์ที่มีปัญหา</button>
        <button className="bg-primary text-primary">อัพเดทหลายออเดอร์</button>
      </section>
    </div>
  );
}
