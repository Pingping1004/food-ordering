import CookerHeader from '@/component/cookers/Header';

export default function CookerHomePage() {
  return (
    <div>
      <CookerHeader />
      <section className="w-full flex flex-col justify-between">
        <button>ออเดอร์ที่มีปัญหา</button>
        <button>อัพเดทหลายออเดอร์</button>
      </section>
    </div>
  );
}
