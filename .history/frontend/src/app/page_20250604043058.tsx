import CookerHeader from "@/component/cookers/Header";

export default function CookerHomePage() {
    return (
        <div>
            <CookerHeader />
            <section className="grid grid-cols-2 px-6 gap-6 text-sm">
                <button className="bg-danger-main text-white noto-sans-bold px-5 py-2.5 rounded-2xl">ออเดอร์ที่มีปัญหา</button>
                <button className="bg-primary-light text-primary-main px-5 py-2.5 rounded-2xl">อัพเดทหลายออเดอร์</button>
            </section>
        </div>
    );
}
