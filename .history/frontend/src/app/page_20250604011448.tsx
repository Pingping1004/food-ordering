import CookerHeader from '@/component/cookers/Header';

export default function CookerHomePage() {
  return (
    <div>
      <CookerHeader />
      <section className="grid grid-cols-2">
        <button className="">ออเดอร์ที่มีปัญหา</button>
        <button>อัพเดทหลายออเดอร์</button>
      </section>
    </div>
  );
}
